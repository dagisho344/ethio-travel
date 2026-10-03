import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Prisma, UserRestrictionCapability, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import type { Server } from 'node:http';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuditService } from '../src/audit/audit.service';
import { AUDIT_ACTIONS } from '../src/audit/audit.constants';
import { AuthService } from '../src/auth/auth.service';
import { AuthenticatedUser } from '../src/auth/authenticated-user';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { PrismaService } from '../src/prisma/prisma.service';
import { RedisService } from '../src/redis/redis.service';
import {
  restrictionIsActive,
  UserRestrictionsService,
} from '../src/users/user-restrictions.service';

// Explicit opt-in. The only persistent change to public is migration 24 itself;
// fixtures and E2E requests use a random disposable PostgreSQL schema.
const databaseDescribe =
  process.env.USER_RESTRICTIONS_DATABASE_TESTS === '1'
    ? describe
    : describe.skip;
const schema = `phase17a2b_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
const password = 'Phase17A2B-Test-Password!23';
const capabilities = Object.values(UserRestrictionCapability);

type Counts = {
  users: number;
  profiles: number;
  roles: number;
  sessions: number;
  restrictions: number;
  audits: number;
};

async function counts(db: PrismaService): Promise<Counts> {
  const [users, profiles, roles, sessions, restrictions, audits] =
    await Promise.all([
      db.user.count(),
      db.userProfile.count(),
      db.userRole.count(),
      db.session.count(),
      db.userRestriction.count(),
      db.auditLog.count(),
    ]);
  return { users, profiles, roles, sessions, restrictions, audits };
}

function actor(id: string, email: string): AuthenticatedUser {
  return { sub: id, email, roles: ['ADMIN'], sessionId: randomUUID() };
}

databaseDescribe('Phase 17A-2B real PostgreSQL restriction foundation', () => {
  let root: PrismaService | undefined;
  let db: PrismaService;
  let dbB: PrismaService;
  let monitor: PrismaService;
  let restrictions: UserRestrictionsService;
  let restrictionsB: UserRestrictionsService;
  let adminA: AuthenticatedUser;
  let adminB: AuthenticatedUser;
  let adminRoleId: string;
  let travelerRoleId: string;
  let app: INestApplication | undefined;
  let server: Server;
  let originalCounts: Counts | undefined;
  let schemaCreated = false;

  async function makeUser(label: string, status = UserStatus.ACTIVE) {
    const email = `${label}-${schema}@example.invalid`;
    const user = await db.user.create({
      data: {
        email,
        passwordHash: await argon2.hash(password),
        status,
        profile: { create: { firstName: 'Fixture', lastName: label } },
        roles: { create: { roleId: travelerRoleId } },
      },
    });
    return user;
  }

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error('DATABASE_URL is required.');
    const parsed = new URL(databaseUrl);
    if (parsed.searchParams.get('schema') !== 'public') {
      throw new Error('Only a public-schema source URL is supported.');
    }
    if (!/^phase17a2b_[a-f0-9]{16}$/.test(schema)) {
      throw new Error('Unsafe disposable schema name.');
    }
    root = new PrismaService({ datasources: { db: { url: databaseUrl } } });
    await root.$connect();
    originalCounts = await counts(root);
    const existing = await root.$queryRaw<Array<{ name: string }>>(
      Prisma.sql`SELECT nspname AS name FROM pg_namespace WHERE nspname = ${schema}`,
    );
    if (existing.length) throw new Error('Disposable schema already exists.');
    await root.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    schemaCreated = true;
    parsed.searchParams.set('schema', schema);
    const testUrl = parsed.toString();
    const migrate = spawnSync(
      process.execPath,
      [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: { ...process.env, DATABASE_URL: testUrl },
        timeout: 180_000,
      },
    );
    if (migrate.status !== 0) {
      throw new Error(
        `Disposable-schema migration failed (${migrate.status}).`,
      );
    }
    db = new PrismaService({ datasources: { db: { url: testUrl } } });
    dbB = new PrismaService({ datasources: { db: { url: testUrl } } });
    monitor = new PrismaService({ datasources: { db: { url: testUrl } } });
    await Promise.all([db.$connect(), dbB.$connect(), monitor.$connect()]);
    await db.role.createMany({
      data: [
        { name: 'ADMIN' },
        { name: 'TRAVELER' },
        { name: 'BUSINESS_OWNER' },
        { name: 'BUSINESS_STAFF' },
      ],
    });
    adminRoleId = (
      await db.role.findUniqueOrThrow({ where: { name: 'ADMIN' } })
    ).id;
    travelerRoleId = (
      await db.role.findUniqueOrThrow({ where: { name: 'TRAVELER' } })
    ).id;
    const hash = await argon2.hash(password);
    const first = await db.user.create({
      data: {
        email: `admin-a-${schema}@example.invalid`,
        passwordHash: hash,
        roles: { create: { roleId: adminRoleId } },
      },
    });
    const second = await db.user.create({
      data: {
        email: `admin-b-${schema}@example.invalid`,
        passwordHash: hash,
        roles: { create: { roleId: adminRoleId } },
      },
    });
    adminA = actor(first.id, first.email);
    adminB = actor(second.id, second.email);
    restrictions = new UserRestrictionsService(db, new AuditService(db));
    restrictionsB = new UserRestrictionsService(dbB, new AuditService(dbB));
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue(db)
      .overrideProvider(RedisService)
      .useValue({ isHealthy: () => Promise.resolve(true) })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        forbidNonWhitelisted: true,
        transform: true,
        whitelist: true,
      }),
    );
    await app.init();
    server = app.getHttpServer() as Server;
  }, 210_000);

  afterAll(async () => {
    await app?.close();
    await Promise.allSettled([
      db?.$disconnect(),
      dbB?.$disconnect(),
      monitor?.$disconnect(),
    ]);
    if (root) {
      try {
        if (schemaCreated) {
          if (!/^phase17a2b_[a-f0-9]{16}$/.test(schema)) {
            throw new Error('Refusing unsafe schema cleanup.');
          }
          await root.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
          const remaining = await root.$queryRaw<Array<{ name: string }>>(
            Prisma.sql`SELECT nspname AS name FROM pg_namespace WHERE nspname = ${schema}`,
          );
          expect(remaining).toHaveLength(0);
        }
        if (originalCounts) expect(await counts(root)).toEqual(originalCounts);
        expect(
          await root.user.count({ where: { email: { contains: schema } } }),
        ).toBe(0);
      } finally {
        await root.$disconnect();
      }
    }
  }, 45_000);

  it('enforces enum, unique row, three FKs, RESTRICT deletes, bounds, nullability and DB timestamp defaults', async () => {
    const target = await makeUser('constraints-target');
    const restricting = await makeUser('constraints-restricting');
    const lifting = await makeUser('constraints-lifting');
    const id = randomUUID();
    await db.$executeRaw(
      Prisma.sql`INSERT INTO user_restrictions (id, user_id, capability, reason, restricted_by_user_id, updated_at) VALUES (${id}::uuid, ${target.id}::uuid, 'BOOKING'::"UserRestrictionCapability", 'constraint proof', ${restricting.id}::uuid, CURRENT_TIMESTAMP)`,
    );
    const saved = await db.userRestriction.findUniqueOrThrow({ where: { id } });
    expect(saved.restrictedAt).toBeInstanceOf(Date);
    expect(saved.createdAt).toBeInstanceOf(Date);
    expect(saved.expiresAt).toBeNull();
    expect(saved.liftedAt).toBeNull();
    expect(saved.liftedByUserId).toBeNull();
    expect(saved.liftReason).toBeNull();
    await expect(
      db.userRestriction.create({
        data: {
          userId: target.id,
          capability: UserRestrictionCapability.BOOKING,
          reason: 'duplicate',
          restrictedByUserId: restricting.id,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
    await expect(
      db.userRestriction.create({
        data: {
          userId: randomUUID(),
          capability: UserRestrictionCapability.REVIEW,
          reason: 'bad target',
          restrictedByUserId: restricting.id,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    await expect(
      db.userRestriction.create({
        data: {
          userId: target.id,
          capability: UserRestrictionCapability.REVIEW,
          reason: 'bad actor',
          restrictedByUserId: randomUUID(),
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    await expect(
      db.userRestriction.update({
        where: { id },
        data: {
          liftedByUserId: randomUUID(),
          liftedAt: new Date(),
        },
      }),
    ).rejects.toMatchObject({ code: 'P2003' });
    await expect(
      db.$queryRaw(Prisma.sql`SELECT 'INVALID'::"UserRestrictionCapability"`),
    ).rejects.toThrow();
    await expect(
      db.userRestriction.update({
        where: { id },
        data: { reason: 'x'.repeat(1001) },
      }),
    ).rejects.toThrow();
    await db.userRestriction.update({
      where: { id },
      data: {
        liftedAt: new Date(),
        liftedByUserId: lifting.id,
        liftReason: 'lifted',
      },
    });
    for (const userId of [target.id, restricting.id, lifting.id]) {
      await expect(db.user.delete({ where: { id: userId } })).rejects.toThrow(
        /violates RESTRICT setting/,
      );
    }
  });

  it('persists restrict/lift/re-restrict episodes, audit safety, ACTIVE status and unrevoked session', async () => {
    const user = await makeUser('lifecycle');
    const session = await db.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: randomUUID(),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    expect(await restrictions.listForAdmin(user.id)).toEqual([]);
    const first = await restrictions.restrict(
      adminA,
      user.id,
      {
        capability: UserRestrictionCapability.BOOKING,
        reason: 'First review',
      },
      {},
    );
    expect(first).toMatchObject({
      active: true,
      capability: 'BOOKING',
      reason: 'First review',
      restrictedByUserId: adminA.sub,
    });
    const stored = await db.userRestriction.findUniqueOrThrow({
      where: { id: first.id },
    });
    expect(stored).toMatchObject({
      expiresAt: null,
      liftedAt: null,
      liftedByUserId: null,
      liftReason: null,
    });
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: user.id } })).status,
    ).toBe(UserStatus.ACTIVE);
    expect(
      (await db.session.findUniqueOrThrow({ where: { id: session.id } }))
        .revokedAt,
    ).toBeNull();
    expect(
      await restrictions.isRestricted(
        user.id,
        UserRestrictionCapability.BOOKING,
      ),
    ).toBe(true);
    await expect(
      restrictions.assertAllowed(user.id, UserRestrictionCapability.BOOKING),
    ).rejects.toMatchObject({
      status: 403,
      response: {
        statusCode: 403,
        error: 'Forbidden',
        message: 'This capability is restricted.',
        code: 'USER_CAPABILITY_RESTRICTED',
        capability: 'BOOKING',
      },
    });
    try {
      await restrictions.assertAllowed(
        user.id,
        UserRestrictionCapability.BOOKING,
      );
      throw new Error('Expected a restricted-capability denial.');
    } catch (error) {
      if (!(error instanceof ForbiddenException)) throw error;
      expect(JSON.stringify(error.getResponse())).not.toContain('First review');
      expect(JSON.stringify(error.getResponse())).not.toContain(adminA.sub);
    }
    await expect(
      restrictions.assertAllowed(user.id, UserRestrictionCapability.REVIEW),
    ).resolves.toBeUndefined();
    const lifted = await restrictions.lift(
      adminB,
      user.id,
      UserRestrictionCapability.BOOKING,
      { reason: 'Appeal accepted' },
      {},
    );
    expect(lifted).toMatchObject({
      id: first.id,
      active: false,
      liftedByUserId: adminB.sub,
      liftReason: 'Appeal accepted',
    });
    expect(lifted.liftedAt).toBeInstanceOf(Date);
    await expect(
      restrictions.assertAllowed(user.id, UserRestrictionCapability.BOOKING),
    ).resolves.toBeUndefined();
    const again = await restrictions.restrict(
      adminB,
      user.id,
      {
        capability: UserRestrictionCapability.BOOKING,
        reason: 'Second review',
        expiresAt: '2030-01-01T00:00:00Z',
      },
      {},
    );
    expect(again).toMatchObject({
      id: first.id,
      active: true,
      reason: 'Second review',
      restrictedByUserId: adminB.sub,
      liftedAt: null,
      liftedByUserId: null,
      liftReason: null,
    });
    expect(again.restrictedAt.getTime()).toBeGreaterThanOrEqual(
      first.restrictedAt.getTime(),
    );
    expect(
      await db.userRestriction.count({
        where: {
          userId: user.id,
          capability: UserRestrictionCapability.BOOKING,
        },
      }),
    ).toBe(1);
    const audits = await db.auditLog.findMany({
      where: { entityId: user.id },
      orderBy: { createdAt: 'asc' },
    });
    expect(audits.map((item) => item.action)).toEqual([
      AUDIT_ACTIONS.ADMIN_USER_RESTRICTED,
      AUDIT_ACTIONS.ADMIN_USER_RESTRICTION_LIFTED,
      AUDIT_ACTIONS.ADMIN_USER_RESTRICTED,
    ]);
    expect(audits.map((item) => item.actorUserId)).toEqual([
      adminA.sub,
      adminB.sub,
      adminB.sub,
    ]);
    expect(audits[0]?.metadata).toMatchObject({
      targetUserId: user.id,
      capability: 'BOOKING',
      expiresAt: null,
    });
    expect(audits[1]?.reason).toBe('Appeal accepted');
    expect(audits[2]?.metadata).toMatchObject({
      expiresAt: '2030-01-01T00:00:00.000Z',
    });
    const serialized = JSON.stringify(audits);
    for (const secret of [
      password,
      'passwordHash',
      'refreshToken',
      'sessionSecret',
      'messageBody',
      'reviewBody',
    ]) {
      expect(serialized).not.toContain(secret);
    }
    expect(
      (await db.session.findUniqueOrThrow({ where: { id: session.id } }))
        .revokedAt,
    ).toBeNull();
  });

  it('treats expiry as inactive without a job and reuses the expired row', async () => {
    const user = await makeUser('expired');
    const first = await restrictions.restrict(
      adminA,
      user.id,
      {
        capability: UserRestrictionCapability.REVIEW,
        reason: 'Time limited',
        expiresAt: '2030-01-01T00:00:00Z',
      },
      {},
    );
    await db.userRestriction.update({
      where: { id: first.id },
      data: { expiresAt: new Date('2000-01-01T00:00:00Z') },
    });
    expect(
      await restrictions.isRestricted(
        user.id,
        UserRestrictionCapability.REVIEW,
      ),
    ).toBe(false);
    await expect(
      restrictions.assertAllowed(user.id, UserRestrictionCapability.REVIEW),
    ).resolves.toBeUndefined();
    await expect(
      restrictions.lift(
        adminA,
        user.id,
        UserRestrictionCapability.REVIEW,
        { reason: 'Already expired' },
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(
      restrictionIsActive(
        { expiresAt: new Date('2026-01-01T00:00:00Z'), liftedAt: null },
        new Date('2026-01-01T00:00:00Z'),
      ),
    ).toBe(false);
    const again = await restrictions.restrict(
      adminB,
      user.id,
      {
        capability: UserRestrictionCapability.REVIEW,
        reason: 'Renewed',
      },
      {},
    );
    expect(again).toMatchObject({
      id: first.id,
      active: true,
      reason: 'Renewed',
      restrictedByUserId: adminB.sub,
      expiresAt: null,
    });
    expect(
      await db.userRestriction.count({
        where: {
          userId: user.id,
          capability: UserRestrictionCapability.REVIEW,
        },
      }),
    ).toBe(1);
    expect(
      await db.auditLog.count({
        where: {
          entityId: user.id,
          action: AUDIT_ACTIONS.ADMIN_USER_RESTRICTED,
        },
      }),
    ).toBe(2);
  });

  it('rejects stale transitions, missing users, past expiry and current Admin targets', async () => {
    const user = await makeUser('invalid');
    await expect(
      restrictions.lift(
        adminA,
        user.id,
        UserRestrictionCapability.BOOKING,
        { reason: 'Missing' },
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      restrictions.restrict(
        adminA,
        randomUUID(),
        { capability: UserRestrictionCapability.BOOKING, reason: 'Missing' },
        {},
      ),
    ).rejects.toThrow();
    await expect(
      restrictions.restrict(
        adminA,
        user.id,
        {
          capability: UserRestrictionCapability.BOOKING,
          reason: 'Expired',
          expiresAt: '2000-01-01T00:00:00Z',
        },
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await restrictions.restrict(
      adminA,
      user.id,
      { capability: UserRestrictionCapability.BOOKING, reason: 'Active' },
      {},
    );
    await expect(
      restrictions.restrict(
        adminB,
        user.id,
        { capability: UserRestrictionCapability.BOOKING, reason: 'Duplicate' },
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    await restrictions.lift(
      adminA,
      user.id,
      UserRestrictionCapability.BOOKING,
      { reason: 'Resolved' },
      {},
    );
    await expect(
      restrictions.lift(
        adminA,
        user.id,
        UserRestrictionCapability.BOOKING,
        { reason: 'Again' },
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    for (const cap of [
      UserRestrictionCapability.BOOKING,
      UserRestrictionCapability.BUSINESS_MANAGEMENT,
    ]) {
      await expect(
        restrictions.restrict(
          adminB,
          adminA.sub,
          { capability: cap, reason: 'Admin target' },
          {},
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    }
  });

  it('retains restriction state through target status changes and does not exempt a later-promoted Admin from the generic policy', async () => {
    const user = await makeUser('statuses');
    await restrictions.restrict(
      adminA,
      user.id,
      { capability: UserRestrictionCapability.BOOKING, reason: 'Status test' },
      {},
    );
    for (const status of [UserStatus.SUSPENDED, UserStatus.DEACTIVATED]) {
      await db.user.update({ where: { id: user.id }, data: { status } });
      expect((await restrictions.listForAdmin(user.id))[0]).toMatchObject({
        active: true,
        capability: 'BOOKING',
      });
      await expect(
        restrictions.restrict(
          adminA,
          user.id,
          {
            capability: UserRestrictionCapability.REVIEW,
            reason: 'Disallowed',
          },
          {},
        ),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(
        await db.userRestriction.count({ where: { userId: user.id } }),
      ).toBe(1);
    }
    await db.user.update({
      where: { id: user.id },
      data: { status: UserStatus.ACTIVE },
    });
    expect(
      await restrictions.isRestricted(
        user.id,
        UserRestrictionCapability.BOOKING,
      ),
    ).toBe(true);
    await db.userRole.create({
      data: { userId: user.id, roleId: adminRoleId },
    });
    expect(
      await restrictions.isRestricted(
        user.id,
        UserRestrictionCapability.BOOKING,
      ),
    ).toBe(true);
    await expect(
      restrictions.restrict(
        adminA,
        user.id,
        { capability: UserRestrictionCapability.REVIEW, reason: 'Admin now' },
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await restrictions.lift(
      adminA,
      user.id,
      UserRestrictionCapability.BOOKING,
      { reason: 'Safe cleanup' },
      {},
    );
  });

  it('stores all five capabilities independently without touching UserStatus or sessions', async () => {
    const user = await makeUser('capabilities');
    for (const cap of capabilities) {
      await restrictions.restrict(
        adminA,
        user.id,
        { capability: cap, reason: `Test ${cap}` },
        {},
      );
      expect(await restrictions.isRestricted(user.id, cap)).toBe(true);
    }
    expect(await db.userRestriction.count({ where: { userId: user.id } })).toBe(
      5,
    );
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: user.id } })).status,
    ).toBe(UserStatus.ACTIVE);
  });

  async function waitForUserLockWaiters(expected: number): Promise<void> {
    const pattern = '%FROM users WHERE id = %FOR UPDATE%';
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const rows = await monitor.$queryRaw<Array<{ waiting: bigint }>>(
        Prisma.sql`SELECT count(*)::bigint AS waiting FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE ${pattern}`,
      );
      if (Number(rows[0]?.waiting ?? 0n) >= expected) return;
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    throw new Error(`${expected} target-row lock waiters were not observed.`);
  }

  async function compete(
    userId: string,
    left: () => Promise<unknown>,
    right: () => Promise<unknown>,
  ) {
    let inFlight: Array<Promise<unknown>> = [];
    await db.$transaction(
      async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`,
        );
        inFlight = [left(), right()];
        await waitForUserLockWaiters(2);
      },
      { timeout: 15_000 },
    );
    return Promise.allSettled(inFlight);
  }

  it('serializes restrict/restrict, lift/lift, restrict/lift and expired re-restrict with independent connections', async () => {
    const user = await makeUser('concurrent');
    const cap = UserRestrictionCapability.MESSAGING;
    const first = await compete(
      user.id,
      () =>
        restrictions.restrict(
          adminA,
          user.id,
          { capability: cap, reason: 'First' },
          {},
        ),
      () =>
        restrictionsB.restrict(
          adminB,
          user.id,
          { capability: cap, reason: 'Second' },
          {},
        ),
    );
    expect(first.filter((item) => item.status === 'fulfilled')).toHaveLength(1);
    expect(
      first.filter(
        (item) =>
          item.status === 'rejected' &&
          item.reason instanceof ConflictException,
      ),
    ).toHaveLength(1);
    expect(
      await db.userRestriction.count({
        where: { userId: user.id, capability: cap },
      }),
    ).toBe(1);
    expect(
      await db.auditLog.count({
        where: {
          entityId: user.id,
          action: AUDIT_ACTIONS.ADMIN_USER_RESTRICTED,
        },
      }),
    ).toBe(1);
    const second = await compete(
      user.id,
      () =>
        restrictions.lift(adminA, user.id, cap, { reason: 'First lift' }, {}),
      () =>
        restrictionsB.lift(adminB, user.id, cap, { reason: 'Second lift' }, {}),
    );
    expect(second.filter((item) => item.status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(
      second.filter(
        (item) =>
          item.status === 'rejected' &&
          item.reason instanceof ConflictException,
      ),
    ).toHaveLength(1);
    const third = await compete(
      user.id,
      () =>
        restrictions.restrict(
          adminA,
          user.id,
          { capability: cap, reason: 'Reapply' },
          {},
        ),
      () =>
        restrictionsB.lift(adminB, user.id, cap, { reason: 'Race lift' }, {}),
    );
    expect(third.some((item) => item.status === 'fulfilled')).toBe(true);
    expect(
      third.some(
        (item) =>
          item.status === 'rejected' &&
          !(item.reason instanceof ConflictException),
      ),
    ).toBe(false);
    const expectedActive =
      third[0]?.status === 'fulfilled' && third[1]?.status === 'rejected';
    expect(await restrictions.isRestricted(user.id, cap)).toBe(expectedActive);
    const row = await db.userRestriction.findUniqueOrThrow({
      where: { userId_capability: { userId: user.id, capability: cap } },
    });
    await db.userRestriction.update({
      where: { id: row.id },
      data: {
        expiresAt: new Date('2000-01-01T00:00:00Z'),
        liftedAt: null,
        liftedByUserId: null,
        liftReason: null,
      },
    });
    const fourth = await compete(
      user.id,
      () =>
        restrictions.restrict(
          adminA,
          user.id,
          { capability: cap, reason: 'Expired reapply A' },
          {},
        ),
      () =>
        restrictionsB.restrict(
          adminB,
          user.id,
          { capability: cap, reason: 'Expired reapply B' },
          {},
        ),
    );
    expect(fourth.filter((item) => item.status === 'fulfilled')).toHaveLength(
      1,
    );
    expect(
      fourth.filter(
        (item) =>
          item.status === 'rejected' &&
          item.reason instanceof ConflictException,
      ),
    ).toHaveLength(1);
    expect(
      await db.userRestriction.count({
        where: { userId: user.id, capability: cap },
      }),
    ).toBe(1);
    const successfulRestricts =
      first.filter((item) => item.status === 'fulfilled').length +
      Number(third[0]?.status === 'fulfilled') +
      fourth.filter((item) => item.status === 'fulfilled').length;
    expect(
      await db.auditLog.count({
        where: {
          entityId: user.id,
          action: AUDIT_ACTIONS.ADMIN_USER_RESTRICTED,
        },
      }),
    ).toBe(successfulRestricts);
  }, 70_000);

  async function cancelBlockedAuditInsert(): Promise<void> {
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const rows = await monitor.$queryRaw<Array<{ pid: number }>>(
        Prisma.sql`SELECT activity.pid FROM pg_stat_activity AS activity JOIN pg_locks AS lock ON lock.pid = activity.pid JOIN pg_class AS relation ON relation.oid = lock.relation JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace WHERE activity.datname = current_database() AND activity.wait_event_type = 'Lock' AND lock.granted = false AND namespace.nspname = ${schema} AND relation.relname = 'audit_logs' AND activity.query ILIKE '%audit_logs%'`,
      );
      if (rows[0]) {
        // Cancel only the identified disposable-schema INSERT, not its process.
        const cancelled = await monitor.$queryRaw<
          Array<{ cancelled: boolean }>
        >(
          Prisma.sql`SELECT pg_cancel_backend(${rows[0].pid}::int) AS cancelled`,
        );
        expect(cancelled[0]?.cancelled).toBe(true);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 40));
    }
    throw new Error('Audit insert did not reach the table-lock barrier.');
  }

  it('rolls back a restriction mutation when the real audit insert cannot complete', async () => {
    const user = await makeUser('rollback');
    const before = await counts(db);
    await db.$transaction(
      async (tx) => {
        await tx.$executeRaw`LOCK TABLE audit_logs IN ACCESS EXCLUSIVE MODE`;
        const pending = restrictionsB.restrict(
          adminB,
          user.id,
          {
            capability: UserRestrictionCapability.BOOKING,
            reason: 'Rollback proof',
          },
          {},
        );
        await cancelBlockedAuditInsert();
        await expect(pending).rejects.toThrow();
      },
      { timeout: 15_000 },
    );
    expect(await counts(db)).toEqual(before);
    expect(await db.userRestriction.count({ where: { userId: user.id } })).toBe(
      0,
    );
    expect(await db.auditLog.count({ where: { entityId: user.id } })).toBe(0);
  }, 25_000);

  it('keeps a signed JWT/session valid through restrict and lift, with no restriction claim', async () => {
    const user = await makeUser('jwt');
    if (!app) throw new Error('Test application is not initialized.');
    const jwt = app.get(JwtService);
    const auth = app.get(AuthService);
    const strategy = app.get(JwtStrategy);
    const login = await auth.login({ email: user.email, password }, {});
    const decoded: unknown = jwt.verify(login.accessToken);
    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded))
      throw new Error('Invalid JWT.');
    const claims = decoded as Record<string, unknown>;
    expect(claims).not.toHaveProperty('restrictions');
    expect(claims).not.toHaveProperty('capabilities');
    if (
      typeof claims.sub !== 'string' ||
      typeof claims.sessionId !== 'string' ||
      typeof claims.email !== 'string' ||
      !Array.isArray(claims.roles)
    )
      throw new Error('Invalid JWT claims.');
    const payload = {
      sub: claims.sub,
      sessionId: claims.sessionId,
      email: claims.email,
      roles: claims.roles as string[],
    };
    await expect(strategy.validate(payload)).resolves.toMatchObject({
      sub: user.id,
    });
    await restrictions.restrict(
      adminA,
      user.id,
      { capability: UserRestrictionCapability.BOOKING, reason: 'Keep session' },
      {},
    );
    await expect(strategy.validate(payload)).resolves.toMatchObject({
      sub: user.id,
    });
    await expect(
      restrictions.assertAllowed(user.id, UserRestrictionCapability.BOOKING),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await restrictions.lift(
      adminA,
      user.id,
      UserRestrictionCapability.BOOKING,
      { reason: 'Restore capability' },
      {},
    );
    await expect(strategy.validate(payload)).resolves.toMatchObject({
      sub: user.id,
    });
    await expect(
      restrictions.assertAllowed(user.id, UserRestrictionCapability.BOOKING),
    ).resolves.toBeUndefined();
    expect(
      (await db.session.findUniqueOrThrow({ where: { id: payload.sessionId } }))
        .revokedAt,
    ).toBeNull();
  });

  it('protects the real persisted Admin HTTP routes and validates request bodies', async () => {
    const user = await makeUser('http');
    const base = `/api/v1/admin/users/${user.id}/restrictions`;
    if (!app) throw new Error('Test application is not initialized.');
    const auth = app.get(AuthService);
    const adminToken = (await auth.login({ email: adminA.email, password }, {}))
      .accessToken;
    const travelerToken = (
      await auth.login({ email: user.email, password }, {})
    ).accessToken;
    const travelerClaims = app.get(JwtService).verify<{
      sub: string;
      email: string;
      roles: string[];
      sessionId: string;
    }>(travelerToken);
    expect(travelerClaims.sub).toBe(user.id);
    await expect(
      app.get(JwtStrategy).validate(travelerClaims),
    ).resolves.toMatchObject({ sub: user.id });
    const adminGet = (url: string) =>
      request(server).get(url).auth(adminToken, { type: 'bearer' });
    const adminPost = (url: string) =>
      request(server).post(url).auth(adminToken, { type: 'bearer' });
    await request(server).get(base).expect(401);
    await request(server)
      .post(base)
      .send({ capability: 'BOOKING', reason: 'Policy' })
      .expect(401);
    await request(server)
      .get(base)
      .auth(travelerToken, { type: 'bearer' })
      .expect(403);
    await request(server)
      .post(base)
      .auth(travelerToken, { type: 'bearer' })
      .send({ capability: 'BOOKING', reason: 'Policy' })
      .expect(403);
    await request(server)
      .post(`${base}/BOOKING/lift`)
      .auth(travelerToken, { type: 'bearer' })
      .send({ reason: 'Lift' })
      .expect(403);
    await adminGet(base).expect(200);
    for (const body of [
      { capability: 'booking', reason: 'Policy' },
      { capability: 'BOOKING', reason: ' ' },
      { capability: 'BOOKING', reason: 'x'.repeat(1001) },
      { capability: 'BOOKING', reason: 'Policy', expiresAt: 'not-a-date' },
      {
        capability: 'BOOKING',
        reason: 'Policy',
        expiresAt: '2000-01-01T00:00:00Z',
      },
      {
        capability: 'BOOKING',
        reason: 'Policy',
        restrictedByUserId: adminA.sub,
      },
    ])
      await adminPost(base).send(body).expect(400);
    await adminPost('/api/v1/admin/users/not-a-uuid/restrictions')
      .send({ capability: 'BOOKING', reason: 'Policy' })
      .expect(400);
    await adminPost(`${base}/INVALID/lift`)
      .send({ reason: 'Lift' })
      .expect(400);
    await adminPost(`${base}/BOOKING/lift`).send({ reason: ' ' }).expect(400);
    await adminPost(`/api/v1/admin/users/${randomUUID()}/restrictions`)
      .send({ capability: 'BOOKING', reason: 'Policy' })
      .expect(404);
    await adminPost(`/api/v1/admin/users/${adminA.sub}/restrictions`)
      .send({ capability: 'BOOKING', reason: 'Policy' })
      .expect(403);
    await adminPost(base)
      .send({
        capability: 'BOOKING',
        reason: '  API review  ',
        expiresAt: '2030-01-01T00:00:00Z',
      })
      .expect(201);
    const list = await adminGet(base).expect(200);
    expect(list.body).toEqual([
      expect.objectContaining({
        capability: 'BOOKING',
        active: true,
        reason: 'API review',
      }),
    ]);
    await adminPost(`${base}/BOOKING/lift`)
      .send({ reason: '  Resolved  ' })
      .expect(200);
    expect(
      (
        await db.userRestriction.findUniqueOrThrow({
          where: {
            userId_capability: {
              userId: user.id,
              capability: UserRestrictionCapability.BOOKING,
            },
          },
        })
      ).liftReason,
    ).toBe('Resolved');
    await db.user.update({
      where: { id: user.id },
      data: { status: UserStatus.SUSPENDED },
    });
    await adminGet(base).expect(200);
    await adminPost(base)
      .send({ capability: 'REVIEW', reason: 'Disallowed' })
      .expect(409);
    await db.user.update({
      where: { id: user.id },
      data: { status: UserStatus.DEACTIVATED },
    });
    await adminGet(base).expect(200);
    await adminPost(base)
      .send({ capability: 'REVIEW', reason: 'Disallowed' })
      .expect(409);
    await adminGet(`/api/v1/users/${user.id}/restrictions`).expect(404);
  }, 30_000);
});
