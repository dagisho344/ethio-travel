import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { AdminService } from '../src/admin/admin.service';
import { AuditService } from '../src/audit/audit.service';
import { AUDIT_ACTIONS } from '../src/audit/audit.constants';
import { AuthService } from '../src/auth/auth.service';
import { AuthenticatedUser } from '../src/auth/authenticated-user';
import { RoleName } from '../src/auth/roles.constants';
import { JwtStrategy } from '../src/auth/strategies/jwt.strategy';
import { AppConfig } from '../src/config/app.config';
import { PrismaService } from '../src/prisma/prisma.service';
import { UsersService } from '../src/users/users.service';

// Run explicitly with ADMIN_USERS_DATABASE_TESTS=1. The suite provisions and
// drops its own schema; it never changes public-schema user or audit records.
const databaseDescribe =
  process.env.ADMIN_USERS_DATABASE_TESTS === '1' ? describe : describe.skip;
const schema = `phase17a1b_${randomUUID().replaceAll('-', '').slice(0, 16)}`;
const temporaryPassword = 'Phase17A1B-Test-Password!23';
const accessSecret = 'phase17a1b-test-access-secret-at-least-32-chars';

type Counts = {
  users: number;
  profiles: number;
  roles: number;
  sessions: number;
  audits: number;
  activeAdmins: number;
};

async function counts(db: PrismaService): Promise<Counts> {
  const [users, profiles, roles, sessions, audits, activeAdmins] =
    await Promise.all([
      db.user.count(),
      db.userProfile.count(),
      db.userRole.count(),
      db.session.count(),
      db.auditLog.count(),
      db.user.count({
        where: {
          status: UserStatus.ACTIVE,
          roles: { some: { role: { name: 'ADMIN' } } },
        },
      }),
    ]);
  return { users, profiles, roles, sessions, audits, activeAdmins };
}

function adminActor(id: string, email: string): AuthenticatedUser {
  return { sub: id, email, roles: ['ADMIN'], sessionId: randomUUID() };
}

databaseDescribe('Phase 17A-1 real PostgreSQL Admin user security', () => {
  let root: PrismaService | undefined;
  let db: PrismaService;
  let dbB: PrismaService;
  let monitor: PrismaService;
  let service: AdminService;
  let serviceB: AdminService;
  let auth: AuthService;
  let jwt: JwtService;
  let strategy: JwtStrategy;
  let actorA: AuthenticatedUser;
  let actorB: AuthenticatedUser;
  let travelerId: string;
  let travelerEmail: string;
  let testUrl = '';
  let schemaCreated = false;
  let originalCounts: Counts | undefined;

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error('DATABASE_URL is required.');
    const parsed = new URL(databaseUrl);
    if (parsed.searchParams.get('schema') !== 'public') {
      throw new Error('The test requires a public-schema source URL.');
    }
    root = new PrismaService({ datasources: { db: { url: databaseUrl } } });
    await root.$connect();
    originalCounts = await counts(root);
    const existing = await root.$queryRaw<Array<{ name: string }>>(
      Prisma.sql`SELECT nspname AS name FROM pg_namespace WHERE nspname = ${schema}`,
    );
    if (existing.length) throw new Error('Disposable test schema exists.');
    if (!/^phase17a1b_[a-f0-9]{16}$/.test(schema)) {
      throw new Error('Unsafe test schema identifier.');
    }
    await root.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    schemaCreated = true;
    parsed.searchParams.set('schema', schema);
    testUrl = parsed.toString();
    const migrate = spawnSync(
      process.execPath,
      [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: { ...process.env, DATABASE_URL: testUrl },
        timeout: 120_000,
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
    const hash = await argon2.hash(temporaryPassword);
    const userA = await db.user.create({
      data: {
        email: `admin-a-${schema}@example.invalid`,
        passwordHash: hash,
        roles: { create: { role: { connect: { name: 'ADMIN' } } } },
      },
    });
    const userB = await db.user.create({
      data: {
        email: `admin-b-${schema}@example.invalid`,
        passwordHash: hash,
        roles: { create: { role: { connect: { name: 'ADMIN' } } } },
      },
    });
    actorA = adminActor(userA.id, userA.email);
    actorB = adminActor(userB.id, userB.email);
    service = new AdminService(db, new AuditService(db));
    serviceB = new AdminService(dbB, new AuditService(dbB));
    const config = {
      get: (key: string) =>
        key === 'refreshTokenExpiresDays' ? 7 : accessSecret,
    } as unknown as ConfigService<AppConfig, true>;
    jwt = new JwtService({ secret: accessSecret });
    auth = new AuthService(config, jwt, db, new UsersService(db));
    strategy = new JwtStrategy(config, db);
    expect((await counts(db)).activeAdmins).toBe(2);
  }, 150_000);

  afterAll(async () => {
    await Promise.allSettled([
      db?.$disconnect(),
      dbB?.$disconnect(),
      monitor?.$disconnect(),
    ]);
    if (root) {
      try {
        if (schemaCreated) {
          if (!/^phase17a1b_[a-f0-9]{16}$/.test(schema)) {
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
          await root.user.count({
            where: { email: { contains: schema } },
          }),
        ).toBe(0);
      } finally {
        await root.$disconnect();
      }
    }
  }, 30_000);

  it('persists created user, profile, Argon2 hash, role and safe audit; rejects duplicates and invalid roles', async () => {
    travelerEmail = `traveler-${schema}@example.invalid`;
    const result = await service.createUser(
      actorA,
      {
        firstName: 'Test',
        lastName: 'Traveler',
        email: travelerEmail.toUpperCase(),
        phone: '+251900000001',
        roles: ['TRAVELER'],
        temporaryPassword,
      },
      {},
    );
    travelerId = result.id;
    expect(result).not.toHaveProperty('passwordHash');
    const stored = await db.user.findUniqueOrThrow({
      where: { id: travelerId },
      include: { profile: true, roles: { include: { role: true } } },
    });
    expect(stored.email).toBe(travelerEmail);
    expect(stored.profile).toMatchObject({
      firstName: 'Test',
      lastName: 'Traveler',
      phone: '+251900000001',
    });
    expect(stored.roles.map((item) => item.role.name)).toEqual(['TRAVELER']);
    expect(stored.passwordHash).not.toBe(temporaryPassword);
    expect(await argon2.verify(stored.passwordHash, temporaryPassword)).toBe(
      true,
    );
    const audit = await db.auditLog.findFirstOrThrow({
      where: { action: AUDIT_ACTIONS.ADMIN_USER_CREATED, entityId: travelerId },
    });
    expect(audit.actorUserId).toBe(actorA.sub);
    expect(audit.metadata).toMatchObject({ targetUserId: travelerId });
    expect(JSON.stringify(audit)).not.toContain(temporaryPassword);
    expect(JSON.stringify(audit)).not.toContain(stored.passwordHash);
    await expect(
      service.createUser(
        actorA,
        {
          firstName: 'Duplicate',
          lastName: 'Email',
          email: travelerEmail,
          roles: ['TRAVELER'],
          temporaryPassword,
        },
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.createUser(
        actorA,
        {
          firstName: 'Invalid',
          lastName: 'Role',
          email: `invalid-${schema}@example.invalid`,
          roles: ['NOT_A_ROLE' as RoleName],
          temporaryPassword,
        },
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rolls back user, profile, role and audit when the audit actor FK fails', async () => {
    const before = await counts(db);
    const rollbackEmail = `rollback-${schema}@example.invalid`;
    await expect(
      service.createUser(
        { ...actorA, sub: randomUUID() },
        {
          firstName: 'Rollback',
          lastName: 'Proof',
          email: rollbackEmail,
          roles: ['TRAVELER'],
          temporaryPassword,
        },
        {},
      ),
    ).rejects.toMatchObject({ code: 'P2003' });
    expect(await counts(db)).toEqual(before);
    expect(
      await db.user.findUnique({ where: { email: rollbackEmail } }),
    ).toBeNull();
  });

  it('persists role and email changes with session revocation and bounded audits', async () => {
    const firstSession = await db.session.create({
      data: {
        userId: travelerId,
        refreshTokenHash: randomUUID(),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    await service.updateUser(
      actorA,
      travelerId,
      { roles: ['BUSINESS_OWNER'] },
      {},
    );
    const assignments = await db.userRole.findMany({
      where: { userId: travelerId },
      include: { role: true },
    });
    expect(assignments.map((item) => item.role.name)).toEqual([
      'BUSINESS_OWNER',
    ]);
    expect(
      (await db.session.findUniqueOrThrow({ where: { id: firstSession.id } }))
        .revokedAt,
    ).not.toBeNull();
    await expect(
      service.updateUser(
        actorA,
        travelerId,
        { roles: ['TRAVELER', 'TRAVELER'] },
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.updateUser(
        actorA,
        travelerId,
        { roles: ['INVALID' as RoleName] },
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    const secondSession = await db.session.create({
      data: {
        userId: travelerId,
        refreshTokenHash: randomUUID(),
        expiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    const nextEmail = `changed-${schema}@example.invalid`;
    await service.updateUser(
      actorA,
      travelerId,
      { email: nextEmail.toUpperCase() },
      {},
    );
    travelerEmail = nextEmail;
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: travelerId } })).email,
    ).toBe(nextEmail);
    expect(
      (await db.session.findUniqueOrThrow({ where: { id: secondSession.id } }))
        .revokedAt,
    ).not.toBeNull();
    await expect(
      service.updateUser(actorA, travelerId, { email: actorA.email }, {}),
    ).rejects.toBeInstanceOf(ConflictException);
    const audits = await db.auditLog.findMany({
      where: { entityId: travelerId },
    });
    expect(
      audits.some(
        (item) => item.action === AUDIT_ACTIONS.ADMIN_USER_ROLE_UPDATED,
      ),
    ).toBe(true);
    expect(
      audits.some((item) => item.action === AUDIT_ACTIONS.ADMIN_USER_UPDATED),
    ).toBe(true);
    expect(JSON.stringify(audits)).not.toContain(temporaryPassword);
    expect(JSON.stringify(audits)).not.toContain(nextEmail);
  });

  it('preserves trip history through lifecycle changes and rejects invalid transitions', async () => {
    const trip = await db.trip.create({
      data: {
        userId: travelerId,
        title: 'Historical trip',
        startDate: new Date('2026-10-01T00:00:00Z'),
        endDate: new Date('2026-10-02T00:00:00Z'),
      },
    });
    await service.suspendUser(
      actorA,
      travelerId,
      { reason: 'Policy review' },
      {},
    );
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: travelerId } })).status,
    ).toBe(UserStatus.SUSPENDED);
    await expect(
      service.suspendUser(actorA, travelerId, { reason: 'Again' }, {}),
    ).rejects.toBeInstanceOf(ConflictException);
    await service.restoreUser(
      actorA,
      travelerId,
      { reason: 'Review complete' },
      {},
    );
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: travelerId } })).status,
    ).toBe(UserStatus.ACTIVE);
    await service.deactivateUser(
      actorA,
      travelerId,
      { reason: 'Account closure' },
      {},
    );
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: travelerId } })).status,
    ).toBe(UserStatus.DEACTIVATED);
    await service.reactivateUser(
      actorA,
      travelerId,
      { reason: 'Appeal accepted' },
      {},
    );
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: travelerId } })).status,
    ).toBe(UserStatus.ACTIVE);
    await service.suspendUser(
      actorA,
      travelerId,
      { reason: 'Second review' },
      {},
    );
    await service.deactivateUser(
      actorA,
      travelerId,
      { reason: 'Closure after suspension' },
      {},
    );
    await expect(
      service.restoreUser(actorA, travelerId, { reason: 'Invalid' }, {}),
    ).rejects.toBeInstanceOf(ConflictException);
    await service.reactivateUser(
      actorA,
      travelerId,
      { reason: 'Reopened' },
      {},
    );
    expect(
      await db.trip.count({ where: { id: trip.id, userId: travelerId } }),
    ).toBe(1);
    expect(
      await db.session.count({
        where: { userId: travelerId, revokedAt: null },
      }),
    ).toBe(0);
  });

  it('enforces self-protection and the actual ACTIVE-plus-ADMIN last-admin rule', async () => {
    await expect(
      service.suspendUser(actorA, actorA.sub, { reason: 'Self' }, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.deactivateUser(actorA, actorA.sub, { reason: 'Self' }, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.updateUser(actorA, actorA.sub, { roles: ['TRAVELER'] }, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await service.deactivateUser(
      actorA,
      actorB.sub,
      { reason: 'Last-admin fixture' },
      {},
    );
    expect((await counts(db)).activeAdmins).toBe(1);
    // The direct service invocation uses a stale actor claim deliberately;
    // real HTTP auth would reject the deactivated actor even earlier.
    await expect(
      serviceB.updateUser(actorB, actorA.sub, { roles: ['TRAVELER'] }, {}),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      serviceB.suspendUser(actorB, actorA.sub, { reason: 'Last admin' }, {}),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      serviceB.deactivateUser(actorB, actorA.sub, { reason: 'Last admin' }, {}),
    ).rejects.toBeInstanceOf(ConflictException);
    await service.reactivateUser(
      actorA,
      actorB.sub,
      { reason: 'Restore fixture' },
      {},
    );
    expect((await counts(db)).activeAdmins).toBe(2);
  });

  async function waitForTwoRoleLockWaiters(): Promise<void> {
    const search = "%FROM roles WHERE name = 'ADMIN' FOR UPDATE%";
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const rows = await monitor.$queryRaw<Array<{ waiting: bigint }>>(
        Prisma.sql`SELECT count(*)::bigint AS waiting FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock' AND query LIKE ${search}`,
      );
      if (Number(rows[0]?.waiting ?? 0n) >= 2) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(
      'Two transactions did not reach the ADMIN row-lock barrier.',
    );
  }

  it('serializes two independent concurrent Admin removals in both directions', async () => {
    for (const reverse of [false, true]) {
      expect((await counts(db)).activeAdmins).toBe(2);
      const attempts = reverse
        ? [
            () =>
              serviceB.deactivateUser(
                actorB,
                actorA.sub,
                { reason: 'Concurrent B' },
                {},
              ),
            () =>
              service.deactivateUser(
                actorA,
                actorB.sub,
                { reason: 'Concurrent A' },
                {},
              ),
          ]
        : [
            () =>
              service.deactivateUser(
                actorA,
                actorB.sub,
                { reason: 'Concurrent A' },
                {},
              ),
            () =>
              serviceB.deactivateUser(
                actorB,
                actorA.sub,
                { reason: 'Concurrent B' },
                {},
              ),
          ];
      let inFlight: Array<Promise<unknown>> = [];
      await db.$transaction(
        async (tx) => {
          await tx.$queryRaw(
            Prisma.sql`SELECT id FROM roles WHERE name = 'ADMIN' FOR UPDATE`,
          );
          inFlight = attempts.map((attempt) => attempt());
          await waitForTwoRoleLockWaiters();
        },
        { timeout: 15_000 },
      );
      const settled = await Promise.allSettled(inFlight);
      expect(
        settled.filter((result) => result.status === 'fulfilled'),
      ).toHaveLength(1);
      expect(
        settled.filter(
          (result) =>
            result.status === 'rejected' &&
            result.reason instanceof ConflictException,
        ),
      ).toHaveLength(1);
      expect((await counts(db)).activeAdmins).toBe(1);
      const deactivated = await db.user.findFirstOrThrow({
        where: {
          id: { in: [actorA.sub, actorB.sub] },
          status: UserStatus.DEACTIVATED,
        },
      });
      const activeActor = deactivated.id === actorA.sub ? actorB : actorA;
      await service.reactivateUser(
        activeActor,
        deactivated.id,
        { reason: 'Reset concurrent fixture' },
        {},
      );
      expect((await counts(db)).activeAdmins).toBe(2);
    }
  }, 30_000);

  it('rejects cryptographically valid JWTs after revocation and requires new login after reactivation', async () => {
    const login = await auth.login(
      { email: travelerEmail, password: temporaryPassword },
      {},
    );
    const decoded: unknown = jwt.verify(login.accessToken);
    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
      throw new Error('Expected a signed access-token payload.');
    }
    const claims = decoded as Record<string, unknown>;
    if (
      typeof claims.sub !== 'string' ||
      typeof claims.sessionId !== 'string' ||
      typeof claims.email !== 'string' ||
      !Array.isArray(claims.roles)
    ) {
      throw new Error('Invalid access-token claims.');
    }
    const payload = {
      sub: claims.sub,
      sessionId: claims.sessionId,
      email: claims.email,
      roles: claims.roles as string[],
    };
    await expect(strategy.validate(payload)).resolves.toMatchObject({
      sub: travelerId,
    });
    await service.suspendUser(
      actorA,
      travelerId,
      { reason: 'JWT revocation proof' },
      {},
    );
    expect(jwt.verify(login.accessToken)).toBeDefined();
    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    await expect(
      auth.refresh({ refreshToken: login.refreshToken }, {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      auth.login({ email: travelerEmail, password: temporaryPassword }, {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await service.restoreUser(
      actorA,
      travelerId,
      { reason: 'JWT test restore' },
      {},
    );
    await expect(strategy.validate(payload)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    const fresh = await auth.login(
      { email: travelerEmail, password: temporaryPassword },
      {},
    );
    await service.deactivateUser(
      actorA,
      travelerId,
      { reason: 'JWT deactivation proof' },
      {},
    );
    await expect(
      auth.login({ email: travelerEmail, password: temporaryPassword }, {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await expect(
      auth.refresh({ refreshToken: fresh.refreshToken }, {}),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    await service.reactivateUser(
      actorA,
      travelerId,
      { reason: 'JWT test reactivation' },
      {},
    );
    const freshClaims: unknown = jwt.verify(fresh.accessToken);
    if (!freshClaims || typeof freshClaims !== 'object')
      throw new Error('Invalid JWT.');
    await expect(
      strategy.validate(freshClaims as typeof payload),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    const renewed = await auth.login(
      { email: travelerEmail, password: temporaryPassword },
      {},
    );
    const renewedClaims: unknown = jwt.verify(renewed.accessToken);
    if (!renewedClaims || typeof renewedClaims !== 'object')
      throw new Error('Invalid JWT.');
    await expect(
      strategy.validate(renewedClaims as typeof payload),
    ).resolves.toMatchObject({ sub: travelerId });
  });

  it('persists bounded audit metadata, reasons and actor identities without secrets', async () => {
    const rows = await db.auditLog.findMany({
      where: {
        entityType: 'USER',
        entityId: { in: [travelerId, actorA.sub, actorB.sub] },
      },
    });
    for (const action of [
      AUDIT_ACTIONS.ADMIN_USER_CREATED,
      AUDIT_ACTIONS.ADMIN_USER_UPDATED,
      AUDIT_ACTIONS.ADMIN_USER_ROLE_UPDATED,
      AUDIT_ACTIONS.ADMIN_USER_SUSPENDED,
      AUDIT_ACTIONS.ADMIN_USER_RESTORED,
      AUDIT_ACTIONS.ADMIN_USER_DEACTIVATED,
      AUDIT_ACTIONS.ADMIN_USER_REACTIVATED,
    ]) {
      expect(rows.some((row) => row.action === action)).toBe(true);
    }
    const reasonActions: readonly string[] = [
      AUDIT_ACTIONS.ADMIN_USER_SUSPENDED,
      AUDIT_ACTIONS.ADMIN_USER_RESTORED,
      AUDIT_ACTIONS.ADMIN_USER_DEACTIVATED,
      AUDIT_ACTIONS.ADMIN_USER_REACTIVATED,
    ];
    for (const row of rows) {
      expect([actorA.sub, actorB.sub]).toContain(row.actorUserId);
      expect(JSON.stringify(row)).not.toContain(temporaryPassword);
      expect(JSON.stringify(row)).not.toContain('passwordHash');
      expect(JSON.stringify(row)).not.toContain('refreshToken');
      expect(JSON.stringify(row)).not.toContain('resetToken');
      expect(JSON.stringify(row)).not.toContain('verificationToken');
      if (reasonActions.includes(row.action)) {
        expect(row.reason?.length).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
