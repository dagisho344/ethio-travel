import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Prisma, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { AdminService } from './admin/admin.service';
import { AdminCreateUserDto, AdminUpdateUserDto } from './admin/dto/admin.dto';
import { AUDIT_ACTIONS } from './audit/audit.constants';
import { AuditService, AuditWrite } from './audit/audit.service';
import { AuthenticatedUser } from './auth/authenticated-user';
import { PrismaService } from './prisma/prisma.service';

const actor: AuthenticatedUser = {
  sub: '11111111-1111-4111-8111-111111111111',
  email: 'admin@example.com',
  roles: ['ADMIN'],
  sessionId: '22222222-2222-4222-8222-222222222222',
};
const targetId = '33333333-3333-4333-8333-333333333333';
const context = {};
const createInput: AdminCreateUserDto = {
  firstName: 'Ada',
  lastName: 'Travel',
  email: '  ADA@EXAMPLE.COM ',
  phone: null,
  roles: ['TRAVELER'],
  temporaryPassword: 'TemporaryPass123!',
};

type MockTx = {
  $queryRaw: jest.Mock<Promise<unknown[]>, [unknown]>;
  role: {
    findMany: jest.Mock<
      Promise<Array<{ id: string; name: string }>>,
      [unknown]
    >;
  };
  user: {
    create: jest.Mock<Promise<unknown>, [unknown]>;
    findUnique: jest.Mock<Promise<unknown>, [unknown]>;
    findUniqueOrThrow: jest.Mock<Promise<unknown>, [unknown]>;
    count: jest.Mock<Promise<number>, [unknown]>;
    update: jest.Mock<Promise<unknown>, [unknown]>;
    updateMany: jest.Mock<Promise<{ count: number }>, [unknown]>;
  };
  userProfile: { upsert: jest.Mock<Promise<unknown>, [unknown]> };
  userRole: {
    deleteMany: jest.Mock<Promise<unknown>, [unknown]>;
    createMany: jest.Mock<Promise<unknown>, [unknown]>;
  };
  session: { updateMany: jest.Mock<Promise<unknown>, [unknown]> };
};

function userRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: targetId,
    email: 'ada@example.com',
    passwordHash: 'argon2-secret-not-public',
    status: UserStatus.ACTIVE as UserStatus,
    profile: { firstName: 'Ada', lastName: 'Travel', phone: null },
    roles: [{ role: { name: 'TRAVELER' } }],
    _count: { businessMembers: 0 },
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    lastLoginAt: null,
    ...overrides,
  };
}

function setup(record = userRecord()) {
  const tx: MockTx = {
    $queryRaw: jest
      .fn<Promise<unknown[]>, [unknown]>()
      .mockResolvedValue([{ id: 'admin-role' }]),
    role: {
      findMany: jest
        .fn<Promise<Array<{ id: string; name: string }>>, [unknown]>()
        .mockResolvedValue([{ id: 'traveler-role', name: 'TRAVELER' }]),
    },
    user: {
      create: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue(record),
      findUnique: jest
        .fn<Promise<unknown>, [unknown]>()
        .mockResolvedValue(record),
      findUniqueOrThrow: jest
        .fn<Promise<unknown>, [unknown]>()
        .mockResolvedValue(record),
      count: jest.fn<Promise<number>, [unknown]>().mockResolvedValue(1),
      update: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue(record),
      updateMany: jest
        .fn<Promise<{ count: number }>, [unknown]>()
        .mockResolvedValue({ count: 1 }),
    },
    userProfile: {
      upsert: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue({}),
    },
    userRole: {
      deleteMany: jest
        .fn<Promise<unknown>, [unknown]>()
        .mockResolvedValue({ count: 1 }),
      createMany: jest
        .fn<Promise<unknown>, [unknown]>()
        .mockResolvedValue({ count: 1 }),
    },
    session: {
      updateMany: jest
        .fn<Promise<unknown>, [unknown]>()
        .mockResolvedValue({ count: 1 }),
    },
  };
  const auditRecord = jest
    .fn<Promise<void>, [unknown, AuditWrite]>()
    .mockResolvedValue(undefined);
  const prisma = {
    $transaction: jest.fn((operation: (client: MockTx) => Promise<unknown>) =>
      operation(tx),
    ),
  } as unknown as PrismaService;
  const audit = { record: auditRecord } as unknown as AuditService;
  return { service: new AdminService(prisma, audit), tx, auditRecord };
}

describe('Phase 17A-1 admin user management', () => {
  it('validates create and update allowlists, password length, roles and email', async () => {
    const invalid = plainToInstance(AdminCreateUserDto, {
      ...createInput,
      email: 'bad',
      roles: ['TRAVELER', 'TRAVELER', 'POWER_USER'],
      temporaryPassword: 'short',
    });
    const failures = await validate(invalid, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(failures.map((item) => item.property)).toEqual(
      expect.arrayContaining(['email', 'roles', 'temporaryPassword']),
    );
    const massAssigned = plainToInstance(AdminUpdateUserDto, {
      id: targetId,
      status: 'ACTIVE',
      passwordHash: 'bad',
      firstName: 'New',
    });
    const unknowns = await validate(massAssigned, {
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    expect(unknowns.map((item) => item.property)).toEqual(
      expect.arrayContaining(['id', 'status', 'passwordHash']),
    );
    const normalized = plainToInstance(AdminCreateUserDto, createInput);
    expect(normalized.email).toBe('ada@example.com');
  });

  it('creates User, Profile, role and audit transactionally without returning or auditing password material', async () => {
    const { service, tx, auditRecord } = setup();
    const result = await service.createUser(actor, createInput, context);
    const createCall = tx.user.create.mock.calls[0]?.[0] as {
      data: {
        email: string;
        passwordHash: string;
        profile: unknown;
        roles: unknown;
      };
    };
    expect(createCall.data.email).toBe('ada@example.com');
    expect(
      await argon2.verify(
        createCall.data.passwordHash,
        createInput.temporaryPassword,
      ),
    ).toBe(true);
    expect(createCall.data.passwordHash).not.toBe(
      createInput.temporaryPassword,
    );
    expect(createCall.data.profile).toBeDefined();
    expect(createCall.data.roles).toBeDefined();
    expect(result).not.toHaveProperty('passwordHash');
    expect(result).not.toHaveProperty('temporaryPassword');
    expect(auditRecord).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ action: AUDIT_ACTIONS.ADMIN_USER_CREATED }),
    );
    expect(JSON.stringify(auditRecord.mock.calls[0]?.[1])).not.toContain(
      createInput.temporaryPassword,
    );
    expect(JSON.stringify(auditRecord.mock.calls[0]?.[1])).not.toContain(
      createCall.data.passwordHash,
    );
  });

  it('rejects an unconfigured role and never creates the user', async () => {
    const { service, tx } = setup();
    tx.role.findMany.mockResolvedValue([]);
    await expect(
      service.createUser(actor, createInput, context),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.user.create).not.toHaveBeenCalled();
  });

  it('maps duplicate email to a safe conflict', async () => {
    const { service, tx } = setup();
    tx.user.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
        code: 'P2002',
        clientVersion: '6.2.1',
        meta: { target: ['email'] },
      }),
    );
    await expect(
      service.createUser(actor, createInput, context),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('updates profile without revoking sessions, but revokes after email or role changes', async () => {
    const { service, tx, auditRecord } = setup();
    await service.updateUser(actor, targetId, { firstName: 'New' }, context);
    expect(tx.userProfile.upsert).toHaveBeenCalled();
    expect(tx.session.updateMany).not.toHaveBeenCalled();
    expect(auditRecord).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ action: AUDIT_ACTIONS.ADMIN_USER_UPDATED }),
    );
    await service.updateUser(
      actor,
      targetId,
      { email: ' CHANGED@EXAMPLE.COM ' },
      context,
    );
    expect(tx.user.update).toHaveBeenCalledWith({
      where: { id: targetId },
      data: { email: 'changed@example.com' },
    });
    expect(tx.session.updateMany).toHaveBeenCalled();
    tx.role.findMany.mockResolvedValue([{ id: 'admin-role', name: 'ADMIN' }]);
    await service.updateUser(actor, targetId, { roles: ['ADMIN'] }, context);
    expect(tx.userRole.deleteMany).toHaveBeenCalled();
    expect(tx.userRole.createMany).toHaveBeenCalled();
    expect(auditRecord).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: AUDIT_ACTIONS.ADMIN_USER_ROLE_UPDATED,
      }),
    );
  });

  it('prevents self ADMIN removal and last-active-Admin removal', async () => {
    const record = userRecord({ roles: [{ role: { name: 'ADMIN' } }] });
    const { service, tx } = setup(record);
    await expect(
      service.updateUser(
        { ...actor, sub: targetId },
        targetId,
        { roles: ['TRAVELER'] },
        context,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    tx.user.count.mockResolvedValue(0);
    await expect(
      service.updateUser(actor, targetId, { roles: ['TRAVELER'] }, context),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.userRole.deleteMany).not.toHaveBeenCalled();
  });

  it('blocks only ACTIVE users, revokes sessions, prevents self and protects the last Admin', async () => {
    const { service, tx, auditRecord } = setup({ ...userRecord(), roles: [] });
    await service.suspendUser(
      actor,
      targetId,
      { reason: 'Policy violation' },
      context,
    );
    expect(tx.session.updateMany).toHaveBeenCalled();
    expect(auditRecord).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ action: AUDIT_ACTIONS.ADMIN_USER_SUSPENDED }),
    );
    await expect(
      service.suspendUser(
        { ...actor, sub: targetId },
        targetId,
        { reason: 'Reason' },
        context,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    tx.user.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      service.suspendUser(actor, targetId, { reason: 'Reason' }, context),
    ).rejects.toBeInstanceOf(ConflictException);
    tx.user.findUnique.mockResolvedValue({
      id: targetId,
      status: UserStatus.ACTIVE,
      roles: [{ roleId: 'admin-role' }],
    });
    tx.user.count.mockResolvedValue(0);
    await expect(
      service.suspendUser(actor, targetId, { reason: 'Reason' }, context),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('deactivates ACTIVE/SUSPENDED with sessions revoked, rejects self and stale transitions', async () => {
    const { service, tx, auditRecord } = setup({ ...userRecord(), roles: [] });
    await service.deactivateUser(
      actor,
      targetId,
      { reason: 'Account closure' },
      context,
    );
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: targetId, status: UserStatus.ACTIVE },
      data: { status: UserStatus.DEACTIVATED },
    });
    expect(tx.session.updateMany).toHaveBeenCalled();
    expect(auditRecord).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: AUDIT_ACTIONS.ADMIN_USER_DEACTIVATED,
        reason: 'Account closure',
      }),
    );
    tx.user.findUnique.mockResolvedValue({
      id: targetId,
      status: UserStatus.SUSPENDED,
      roles: [],
    });
    await service.deactivateUser(
      actor,
      targetId,
      { reason: 'Account closure' },
      context,
    );
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: targetId, status: UserStatus.SUSPENDED },
      data: { status: UserStatus.DEACTIVATED },
    });
    await expect(
      service.deactivateUser(
        { ...actor, sub: targetId },
        targetId,
        { reason: 'Reason' },
        context,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
    tx.user.updateMany.mockResolvedValueOnce({ count: 0 });
    await expect(
      service.deactivateUser(actor, targetId, { reason: 'Reason' }, context),
    ).rejects.toBeInstanceOf(ConflictException);
    tx.user.findUnique.mockResolvedValue({
      id: targetId,
      status: UserStatus.ACTIVE,
      roles: [{ roleId: 'admin-role' }],
    });
    tx.user.count.mockResolvedValue(0);
    await expect(
      service.deactivateUser(actor, targetId, { reason: 'Reason' }, context),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('reactivates only DEACTIVATED without unrevoking sessions and audits', async () => {
    const { service, tx, auditRecord } = setup({
      ...userRecord(),
      status: UserStatus.DEACTIVATED,
    });
    await service.reactivateUser(
      actor,
      targetId,
      { reason: 'Appeal accepted' },
      context,
    );
    expect(tx.session.updateMany).not.toHaveBeenCalled();
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: targetId, status: UserStatus.DEACTIVATED },
      data: { status: UserStatus.ACTIVE },
    });
    expect(auditRecord).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({ action: AUDIT_ACTIONS.ADMIN_USER_REACTIVATED }),
    );
    tx.user.findUnique.mockResolvedValue({
      id: targetId,
      status: UserStatus.ACTIVE,
    });
    await expect(
      service.reactivateUser(actor, targetId, { reason: 'Reason' }, context),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('requires reasons and rejects empty generic updates', async () => {
    const { service } = setup();
    await expect(
      service.deactivateUser(actor, targetId, { reason: 'x' }, context),
    ).rejects.toBeInstanceOf(ConflictException);
    await expect(
      service.updateUser(actor, targetId, {}, context),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
