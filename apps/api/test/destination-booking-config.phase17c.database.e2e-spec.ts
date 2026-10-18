import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { ConflictException } from '@nestjs/common';
import { LocationStatus, Prisma, PublicationStatus } from '@prisma/client';
import { AUDIT_ACTIONS } from '../src/audit/audit.constants';
import { AuditService } from '../src/audit/audit.service';
import { DestinationBookingConfigService } from '../src/destination-booking-config/destination-booking-config.service';
import { PrismaService } from '../src/prisma/prisma.service';

const databaseDescribe =
  process.env.DESTINATION_BOOKING_CONFIG_DATABASE_TESTS === '1'
    ? describe
    : describe.skip;
const schema = `phase17c1_${randomUUID().replaceAll('-', '').slice(0, 16)}`;

databaseDescribe('Phase 17C-1 disposable PostgreSQL configuration', () => {
  let root: PrismaService | undefined;
  let db: PrismaService | undefined;
  let dbB: PrismaService | undefined;
  let service: DestinationBookingConfigService;
  let serviceB: DestinationBookingConfigService;
  let destinationId: string;
  let otherDestinationId: string;
  let adminId: string;
  let schemaCreated = false;
  let originalCounts: { users: number; destinations: number; audits: number };

  beforeAll(async () => {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) throw new Error('DATABASE_URL is required.');
    const parsed = new URL(databaseUrl);
    if (parsed.searchParams.get('schema') !== 'public') {
      throw new Error('The source DATABASE_URL must use schema=public.');
    }
    if (!/^phase17c1_[a-f0-9]{16}$/.test(schema)) {
      throw new Error('Unsafe disposable schema name.');
    }
    root = new PrismaService({ datasources: { db: { url: databaseUrl } } });
    await root.$connect();
    const existing = await root.$queryRaw<Array<{ name: string }>>(
      Prisma.sql`SELECT nspname AS name FROM pg_namespace WHERE nspname = ${schema}`,
    );
    if (existing.length) throw new Error('Disposable schema already exists.');
    originalCounts = {
      users: await root.user.count(),
      destinations: await root.destination.count(),
      audits: await root.auditLog.count(),
    };
    await root.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    schemaCreated = true;
    parsed.searchParams.set('schema', schema);
    const migrate = spawnSync(
      process.execPath,
      [require.resolve('prisma/build/index.js'), 'migrate', 'deploy'],
      {
        cwd: process.cwd(),
        encoding: 'utf8',
        env: { ...process.env, DATABASE_URL: parsed.toString() },
        timeout: 180_000,
      },
    );
    if (migrate.status !== 0) {
      throw new Error(`Disposable migration failed (${migrate.status}).`);
    }
    db = new PrismaService({ datasources: { db: { url: parsed.toString() } } });
    dbB = new PrismaService({
      datasources: { db: { url: parsed.toString() } },
    });
    await Promise.all([db.$connect(), dbB.$connect()]);
    const admin = await db.user.create({
      data: {
        email: `${schema}@example.invalid`,
        passwordHash: 'test-only-hash',
      },
    });
    adminId = admin.id;
    const region = await db.region.create({
      data: {
        name: 'Test Region',
        slug: 'test-region',
        status: LocationStatus.ACTIVE,
      },
    });
    const city = await db.city.create({
      data: {
        regionId: region.id,
        name: 'Test City',
        slug: 'test-city',
        latitude: 9,
        longitude: 38,
        status: LocationStatus.ACTIVE,
      },
    });
    for (const suffix of ['one', 'two']) {
      const destination = await db.destination.create({
        data: {
          cityId: city.id,
          name: `Test Destination ${suffix}`,
          slug: `test-destination-${suffix}`,
          shortDescription: 'Test only',
          fullDescription: 'Test only',
          latitude: 9,
          longitude: 38,
          status: PublicationStatus.DRAFT,
        },
      });
      if (suffix === 'one') destinationId = destination.id;
      else otherDestinationId = destination.id;
    }
    service = new DestinationBookingConfigService(db, new AuditService(db));
    serviceB = new DestinationBookingConfigService(dbB, new AuditService(dbB));
  }, 210_000);

  afterAll(async () => {
    await Promise.allSettled([db?.$disconnect(), dbB?.$disconnect()]);
    if (root) {
      try {
        if (schemaCreated) {
          if (!/^phase17c1_[a-f0-9]{16}$/.test(schema)) {
            throw new Error('Refusing unsafe disposable schema cleanup.');
          }
          await root.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
          expect(
            await root.$queryRaw<Array<{ name: string }>>(
              Prisma.sql`SELECT nspname AS name FROM pg_namespace WHERE nspname = ${schema}`,
            ),
          ).toHaveLength(0);
          expect({
            users: await root.user.count(),
            destinations: await root.destination.count(),
            audits: await root.auditLog.count(),
          }).toEqual(originalCounts);
        }
      } finally {
        await root.$disconnect();
      }
    }
  }, 30_000);

  it('persists a disabled ETB config and requires description and an account before enablement', async () => {
    const database = db!;
    expect((await service.getConfig(destinationId)).bookingEnabled).toBe(false);
    const saved = await service.updateConfig(
      destinationId,
      adminId,
      {
        bookingEnabled: false,
        priceAmount: '125.25',
        requestDescription: null,
        bookingInstructions: 'Request only',
      },
      {},
    );
    expect(saved).toMatchObject({
      bookingEnabled: false,
      priceAmount: '125.25',
      currency: 'ETB',
      priceUnit: 'PER_BOOKING',
    });
    expect(
      (
        await database.destinationBookingConfig.findUniqueOrThrow({
          where: { destinationId },
        })
      ).priceAmount?.toFixed(2),
    ).toBe('125.25');
    await expect(
      service.updateConfig(
        destinationId,
        adminId,
        {
          bookingEnabled: true,
          priceAmount: '125.25',
          requestDescription: 'Too short',
          bookingInstructions: null,
        },
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.updateConfig(
        destinationId,
        adminId,
        {
          bookingEnabled: true,
          priceAmount: '125.25',
          requestDescription: null,
          bookingInstructions: null,
        },
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect((await service.getConfig(destinationId)).bookingEnabled).toBe(false);
    await expect(
      service.updateConfig(
        destinationId,
        adminId,
        {
          bookingEnabled: true,
          priceAmount: '125.25',
          requestDescription: 'Request a visit; admission is not guaranteed.',
          bookingInstructions: null,
        },
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('stores destination-specific accounts, prevents normalized duplicates and scopes IDs', async () => {
    const database = db!;
    const created = await service.createAccount(
      destinationId,
      adminId,
      {
        provider: 'TELEBIRR',
        accountHolderName: ' Test Holder ',
        accountIdentifier: '+251 912 345 678',
      },
      {},
    );
    expect(created.accountHolderName).toBe('Test Holder');
    expect(
      (
        await database.destinationPaymentAccount.findUniqueOrThrow({
          where: { id: created.id },
        })
      ).normalizedIdentifier,
    ).toBe('+251912345678');
    const enabled = await service.updateConfig(
      destinationId,
      adminId,
      {
        bookingEnabled: true,
        priceAmount: '125.25',
        requestDescription: 'Request a visit; admission is not guaranteed.',
        bookingInstructions: null,
      },
      {},
    );
    expect(enabled.bookingEnabled).toBe(true);
    expect(enabled.requestDescription).toContain('admission is not guaranteed');
    await expect(
      service.deactivateAccount(destinationId, created.id, adminId, {}),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.createAccount(
        destinationId,
        adminId,
        {
          provider: 'TELEBIRR',
          accountHolderName: 'Other',
          accountIdentifier: '0912-345-678',
        },
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.createAccount(
        destinationId,
        adminId,
        {
          provider: 'TELEBIRR',
          accountHolderName: 'Invalid',
          accountIdentifier: '1234567890',
        },
        {},
      ),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      service.updateAccount(
        otherDestinationId,
        created.id,
        adminId,
        { displayOrder: 1 },
        {},
      ),
    ).rejects.toMatchObject({ status: 404 });
    const updated = await service.updateAccount(
      destinationId,
      created.id,
      adminId,
      { displayOrder: 2, instructions: 'Admin only' },
      {},
    );
    expect(updated.displayOrder).toBe(2);
    expect(
      (await service.listAccounts(destinationId, { page: 1, limit: 20 })).meta
        .total,
    ).toBe(1);
    await service.updateConfig(
      destinationId,
      adminId,
      {
        bookingEnabled: false,
        priceAmount: '125.25',
        requestDescription: null,
        bookingInstructions: null,
      },
      {},
    );
    const deactivated = await service.deactivateAccount(
      destinationId,
      created.id,
      adminId,
      {},
    );
    expect(deactivated.isActive).toBe(false);
    expect((await service.getConfig(destinationId)).bookingEnabled).toBe(false);
    const audits = await database.auditLog.findMany({
      where: { entityId: destinationId },
    });
    expect(audits.map((audit) => audit.action)).toEqual(
      expect.arrayContaining([
        AUDIT_ACTIONS.ADMIN_DESTINATION_BOOKING_CONFIG_CREATED,
        AUDIT_ACTIONS.ADMIN_DESTINATION_BOOKING_CONFIG_ENABLED,
        AUDIT_ACTIONS.ADMIN_DESTINATION_BOOKING_CONFIG_DISABLED,
        AUDIT_ACTIONS.ADMIN_DESTINATION_PAYMENT_ACCOUNT_CREATED,
        AUDIT_ACTIONS.ADMIN_DESTINATION_PAYMENT_ACCOUNT_UPDATED,
        AUDIT_ACTIONS.ADMIN_DESTINATION_PAYMENT_ACCOUNT_DEACTIVATED,
      ]),
    );
    expect(JSON.stringify(audits.map((audit) => audit.metadata))).not.toContain(
      '+251',
    );
    expect(JSON.stringify(audits.map((audit) => audit.metadata))).not.toContain(
      'Test Holder',
    );
    expect(JSON.stringify(audits.map((audit) => audit.metadata))).not.toContain(
      'admission is not guaranteed',
    );
  });

  it('rolls back account creation when the real audit FK insert fails', async () => {
    const database = db!;
    const identifier = 'CBE-TEST-12345';
    const beforeAccounts = await database.destinationPaymentAccount.count();
    const beforeAudits = await database.auditLog.count();
    await expect(
      service.createAccount(
        otherDestinationId,
        randomUUID(),
        {
          provider: 'CBE',
          accountHolderName: 'Rollback Test',
          accountIdentifier: identifier,
        },
        {},
      ),
    ).rejects.toThrow();
    expect(await database.destinationPaymentAccount.count()).toBe(
      beforeAccounts,
    );
    expect(await database.auditLog.count()).toBe(beforeAudits);
  });

  it('serializes enable/deactivate and competing deactivations without losing the last active account', async () => {
    const database = db!;
    const first = await service.createAccount(
      otherDestinationId,
      adminId,
      {
        provider: 'CBE',
        accountHolderName: 'First',
        accountIdentifier: 'CBE-11111',
      },
      {},
    );
    await service.updateConfig(
      otherDestinationId,
      adminId,
      {
        bookingEnabled: false,
        priceAmount: '5.00',
        requestDescription: 'Request a visit only.',
        bookingInstructions: null,
      },
      {},
    );
    const enableRace = await Promise.allSettled([
      service.updateConfig(
        otherDestinationId,
        adminId,
        {
          bookingEnabled: true,
          priceAmount: '5.00',
          requestDescription: 'Request a visit only.',
          bookingInstructions: null,
        },
        {},
      ),
      serviceB.deactivateAccount(otherDestinationId, first.id, adminId, {}),
    ]);
    expect(
      enableRace.filter((outcome) => outcome.status === 'fulfilled'),
    ).toHaveLength(1);
    const afterRace = await service.getConfig(otherDestinationId);
    const activeAfterRace = await database.destinationPaymentAccount.count({
      where: { destinationId: otherDestinationId, isActive: true },
    });
    expect(activeAfterRace).toBe(afterRace.bookingEnabled ? 1 : 0);
    await service.updateAccount(
      otherDestinationId,
      first.id,
      adminId,
      { isActive: true },
      {},
    );
    await service.updateConfig(
      otherDestinationId,
      adminId,
      {
        bookingEnabled: true,
        priceAmount: '5.00',
        requestDescription: 'Request a visit only.',
        bookingInstructions: null,
      },
      {},
    );
    const second = await service.createAccount(
      otherDestinationId,
      adminId,
      {
        provider: 'TELEBIRR',
        accountHolderName: 'Second',
        accountIdentifier: '+251900000001',
      },
      {},
    );
    const outcomes = await Promise.allSettled([
      service.deactivateAccount(otherDestinationId, first.id, adminId, {}),
      serviceB.deactivateAccount(otherDestinationId, second.id, adminId, {}),
    ]);
    expect(
      outcomes.filter((outcome) => outcome.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      outcomes.filter((outcome) => outcome.status === 'rejected'),
    ).toHaveLength(1);
    expect(
      await database.destinationPaymentAccount.count({
        where: { destinationId: otherDestinationId, isActive: true },
      }),
    ).toBe(1);
    const remaining = await database.destinationPaymentAccount.findFirstOrThrow(
      {
        where: { destinationId: otherDestinationId, isActive: true },
      },
    );
    await expect(
      service.updateAccount(
        otherDestinationId,
        remaining.id,
        adminId,
        { isActive: false },
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('enforces migrated database checks and keeps archived destinations read-only', async () => {
    const database = db!;
    await expect(
      database.destinationBookingConfig.update({
        where: { destinationId },
        data: { priceAmount: new Prisma.Decimal('-1.00') },
      }),
    ).rejects.toThrow();
    await expect(
      database.destinationBookingConfig.update({
        where: { destinationId },
        data: { currency: 'USD' },
      }),
    ).rejects.toThrow();
    await expect(
      database.destinationBookingConfig.update({
        where: { destinationId },
        data: { bookingEnabled: true },
      }),
    ).rejects.toThrow();
    await expect(
      database.destination.delete({ where: { id: destinationId } }),
    ).rejects.toThrow();
    await database.destination.update({
      where: { id: destinationId },
      data: { status: PublicationStatus.ARCHIVED },
    });
    expect((await service.getConfig(destinationId)).priceAmount).toBe('125.25');
    await expect(
      service.updateConfig(
        destinationId,
        adminId,
        {
          bookingEnabled: false,
          priceAmount: '130.00',
          requestDescription: null,
          bookingInstructions: null,
        },
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.createAccount(
        destinationId,
        adminId,
        {
          provider: 'CBE',
          accountHolderName: 'Archived',
          accountIdentifier: 'CBE-ARCHIVED-123',
        },
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
