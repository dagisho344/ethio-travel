import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { UserRestrictionCapability, UserStatus } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../audit/audit.constants';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';
import {
  LiftUserRestrictionDto,
  RestrictUserDto,
} from './dto/user-restriction.dto';
import {
  restrictionIsActive,
  UserRestrictionsService,
} from './user-restrictions.service';

const actor: AuthenticatedUser = {
  sub: '11111111-1111-4111-8111-111111111111',
  email: 'admin@example.com',
  roles: ['ADMIN'],
  sessionId: '22222222-2222-4222-8222-222222222222',
};
const targetId = '33333333-3333-4333-8333-333333333333';
const capability = UserRestrictionCapability.BOOKING;
const now = new Date('2026-09-30T00:00:00.000Z');

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: '44444444-4444-4444-8444-444444444444',
    userId: targetId,
    capability,
    reason: 'Policy review',
    restrictedByUserId: actor.sub,
    restrictedAt: now,
    expiresAt: null,
    liftedAt: null,
    liftedByUserId: null,
    liftReason: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function setup(existing: ReturnType<typeof row> | null = null) {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: targetId }]),
    user: {
      findUnique: jest.fn().mockResolvedValue({
        status: UserStatus.ACTIVE,
        roles: [],
      }),
    },
    userRestriction: {
      findUnique: jest.fn().mockResolvedValue(existing),
      upsert: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue(row()),
      update: jest
        .fn<Promise<unknown>, [unknown]>()
        .mockResolvedValue(row({ liftedAt: new Date() })),
    },
  };
  const prisma = {
    $transaction: jest.fn((work: (client: typeof tx) => Promise<unknown>) =>
      work(tx),
    ),
    user: { findUnique: jest.fn().mockResolvedValue({ id: targetId }) },
    userRestriction: {
      findMany: jest.fn().mockResolvedValue(existing ? [existing] : []),
      findFirst: jest.fn<Promise<unknown>, [unknown]>().mockResolvedValue(null),
    },
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new UserRestrictionsService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
  );
  return { audit, prisma, service, tx };
}

describe('Phase 17A-2A restriction foundation (no unapplied table required)', () => {
  it('treats expiry at now as inactive, independently of liftedAt', () => {
    expect(restrictionIsActive(row(), now)).toBe(true);
    expect(restrictionIsActive(row({ expiresAt: now }), now)).toBe(false);
    expect(
      restrictionIsActive(row({ expiresAt: new Date(now.getTime() + 1) }), now),
    ).toBe(true);
    expect(restrictionIsActive(row({ liftedAt: now }), now)).toBe(false);
  });

  it('validates strict capability, trimmed reason and explicit-offset future timestamp syntax', async () => {
    const valid = plainToInstance(RestrictUserDto, {
      capability,
      reason: '  review  ',
      expiresAt: '2030-01-01T00:00:00Z',
    });
    expect(valid.reason).toBe('review');
    expect(await validate(valid)).toHaveLength(0);
    for (const invalid of [
      { capability: 'bookings', reason: 'valid' },
      { capability, reason: '   ' },
      { capability, reason: 'valid', expiresAt: '2030-01-01T00:00:00' },
      { capability, reason: 'valid', expiresAt: 'not-a-date' },
    ]) {
      expect(
        await validate(plainToInstance(RestrictUserDto, invalid)),
      ).not.toHaveLength(0);
    }
    expect(
      await validate(plainToInstance(LiftUserRestrictionDto, { reason: '  ' })),
    ).not.toHaveLength(0);
  });

  it('creates only for an active non-Admin, with parent lock and bounded audit metadata', async () => {
    const { audit, service, tx } = setup();
    const result = await service.restrict(
      actor,
      targetId,
      { capability, reason: ' review ' },
      {},
    );
    expect(result).toMatchObject({ capability, active: true });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.userRestriction.upsert.mock.calls[0]?.[0]).toMatchObject({
      where: { userId_capability: { userId: targetId, capability } },
      create: { reason: 'review', restrictedByUserId: actor.sub },
    });
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: AUDIT_ACTIONS.ADMIN_USER_RESTRICTED,
        entityId: targetId,
        metadata: { targetUserId: targetId, capability, expiresAt: null },
      }),
    );
  });

  it('rejects Admin and non-ACTIVE targets without writing', async () => {
    const { service, tx } = setup();
    tx.user.findUnique.mockResolvedValueOnce({
      status: UserStatus.ACTIVE,
      roles: [{ roleId: 'admin' }],
    });
    await expect(
      service.restrict(actor, targetId, { capability, reason: 'Reason' }, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
    tx.user.findUnique.mockResolvedValueOnce({
      status: UserStatus.SUSPENDED,
      roles: [],
    });
    await expect(
      service.restrict(actor, targetId, { capability, reason: 'Reason' }, {}),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.userRestriction.upsert).not.toHaveBeenCalled();
  });

  it('rejects duplicate active restriction and past expiry, but reuses an expired row', async () => {
    const current = setup(row());
    await expect(
      current.service.restrict(
        actor,
        targetId,
        { capability, reason: 'Reason' },
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    const expired = setup(row({ expiresAt: new Date('2000-01-01T00:00:00Z') }));
    await expired.service.restrict(
      actor,
      targetId,
      { capability, reason: 'Again' },
      {},
    );
    expect(expired.tx.userRestriction.upsert.mock.calls[0]?.[0]).toMatchObject({
      update: { liftedAt: null, liftReason: null },
    });
    await expect(
      expired.service.restrict(
        actor,
        targetId,
        { capability, reason: 'Reason', expiresAt: '2000-01-01T00:00:00Z' },
        {},
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('lifts an active restriction, preserving its text and recording an action', async () => {
    const { audit, service, tx } = setup(row());
    await service.lift(actor, targetId, capability, { reason: 'Lifted' }, {});
    expect(tx.userRestriction.update.mock.calls[0]?.[0]).toMatchObject({
      data: { liftedByUserId: actor.sub, liftReason: 'Lifted' },
    });
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: AUDIT_ACTIONS.ADMIN_USER_RESTRICTION_LIFTED,
        reason: 'Lifted',
      }),
    );
    const absent = setup();
    await expect(
      absent.service.lift(
        actor,
        targetId,
        capability,
        { reason: 'Lifted' },
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('provides an expiry-aware 403 without exposing the Admin reason', async () => {
    const { prisma, service } = setup();
    prisma.userRestriction.findFirst.mockResolvedValueOnce({
      id: 'restriction',
    });
    await expect(
      service.assertAllowed(targetId, capability),
    ).rejects.toMatchObject({
      status: 403,
      response: {
        statusCode: 403,
        error: 'Forbidden',
        message: 'This capability is restricted.',
        code: 'USER_CAPABILITY_RESTRICTED',
        capability,
      },
    });
    expect(prisma.userRestriction.findFirst.mock.calls[0]?.[0]).toMatchObject({
      where: { userId: targetId, capability, liftedAt: null },
    });
  });
});
