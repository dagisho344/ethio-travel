import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import {
  BusinessStatus,
  BusinessVerificationSummary,
  UserStatus,
} from '@prisma/client';
import { AuditService } from './audit/audit.service';
import { AUDIT_ACTIONS } from './audit/audit.constants';
import { AdminService } from './admin/admin.service';
import { JwtStrategy } from './auth/strategies/jwt.strategy';
import { BusinessesService } from './businesses/businesses.service';
import { PrismaService } from './prisma/prisma.service';

const admin = {
  email: 'admin@example.com',
  roles: ['ADMIN'],
  sessionId: 'session-id',
  sub: '11111111-1111-4111-8111-111111111111',
};
const userId = '22222222-2222-4222-8222-222222222222';
const businessId = '33333333-3333-4333-8333-333333333333';

function transactionPrisma(transaction: Record<string, unknown>) {
  return {
    $transaction: jest.fn(
      (callback: (tx: Record<string, unknown>) => unknown) =>
        Promise.resolve(callback(transaction)),
    ),
  } as unknown as PrismaService;
}

describe('Phase 13A administrator safety', () => {
  it('revokes existing sessions when an administrator suspends an active user and audits the transition', async () => {
    const transaction = {
      session: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      user: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: userId, status: UserStatus.ACTIVE }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const audit = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;
    const service = new AdminService(transactionPrisma(transaction), audit);

    await expect(
      service.suspendUser(
        admin,
        userId,
        { reason: 'Repeated policy violations.' },
        {},
      ),
    ).resolves.toEqual({ id: userId, status: UserStatus.SUSPENDED });
    expect(transaction.session.updateMany).toHaveBeenCalledWith({
      data: { revokedAt: expect.any(Date) },
      where: { revokedAt: null, userId },
    });
    expect(audit.record).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({ action: AUDIT_ACTIONS.ADMIN_USER_SUSPENDED }),
    );
  });

  it('prevents an administrator from suspending their own account', async () => {
    const service = new AdminService({} as PrismaService, {} as AuditService);
    await expect(
      service.suspendUser(admin, admin.sub, { reason: 'No.' }, {}),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('restores an unverified suspended business to DRAFT rather than publishing it', async () => {
    const transaction = {
      business: {
        findUnique: jest.fn().mockResolvedValue({
          id: businessId,
          status: BusinessStatus.SUSPENDED,
          verificationSummary: BusinessVerificationSummary.REJECTED,
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const audit = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as AuditService;
    const service = new BusinessesService(
      transactionPrisma(transaction),
      audit,
    );

    await expect(
      service.restoreByAdmin(
        admin,
        businessId,
        { reason: 'Corrected supporting information.' },
        {},
      ),
    ).resolves.toEqual({
      id: businessId,
      status: BusinessStatus.DRAFT,
      verificationSummary: BusinessVerificationSummary.REJECTED,
    });
    expect(transaction.business.updateMany).toHaveBeenCalledWith({
      data: { status: BusinessStatus.DRAFT, suspendedAt: null },
      where: { id: businessId, status: BusinessStatus.SUSPENDED },
    });
    expect(audit.record).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({
        action: AUDIT_ACTIONS.ADMIN_BUSINESS_RESTORED,
      }),
    );
  });

  it('rejects a previously issued JWT when its session is revoked or user is no longer active', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const strategy = new JwtStrategy(
      { get: jest.fn().mockReturnValue('test-access-secret') } as never,
      { session: { findFirst } } as unknown as PrismaService,
    );
    await expect(strategy.validate(admin)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          revokedAt: null,
          user: { status: UserStatus.ACTIVE },
        }),
      }),
    );
  });
});
