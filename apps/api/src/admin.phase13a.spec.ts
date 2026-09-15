import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import {
  BusinessStatus,
  BusinessVerificationSummary,
  UserStatus,
} from '@prisma/client';
import { AuditService, AuditWrite } from './audit/audit.service';
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

type MutationResult = { count: number };
type SessionFindFirstInput = {
  select: { id: true };
  where: {
    expiresAt: { gt: Date };
    id: string;
    revokedAt: null;
    user: { status: UserStatus };
    userId: string;
  };
};
type SessionUpdateInput = {
  data: { revokedAt: Date };
  where: { revokedAt: null; userId: string };
};

function transactionPrisma(transaction: Record<string, unknown>) {
  return {
    $transaction: jest.fn(
      (callback: (tx: Record<string, unknown>) => unknown) =>
        Promise.resolve(callback(transaction)),
    ),
  } as unknown as PrismaService;
}

function auditService(
  record: jest.Mock<Promise<void>, [unknown, AuditWrite]>,
): AuditService {
  return { record } as unknown as AuditService;
}

describe('Phase 13A administrator safety', () => {
  it('revokes existing sessions when an administrator suspends an active user and audits the transition', async () => {
    const sessionUpdateMany = jest
      .fn<Promise<MutationResult>, [SessionUpdateInput]>()
      .mockResolvedValue({ count: 1 });
    const transaction = {
      session: { updateMany: sessionUpdateMany },
      user: {
        findUnique: jest
          .fn<Promise<{ id: string; status: UserStatus } | null>, [unknown]>()
          .mockResolvedValue({ id: userId, status: UserStatus.ACTIVE }),
        updateMany: jest
          .fn<Promise<MutationResult>, [unknown]>()
          .mockResolvedValue({ count: 1 }),
      },
    };
    const auditRecord = jest
      .fn<Promise<void>, [unknown, AuditWrite]>()
      .mockResolvedValue(undefined);
    const audit = auditService(auditRecord);
    const service = new AdminService(transactionPrisma(transaction), audit);

    await expect(
      service.suspendUser(
        admin,
        userId,
        { reason: 'Repeated policy violations.' },
        {},
      ),
    ).resolves.toEqual({ id: userId, status: UserStatus.SUSPENDED });
    const updateCall = sessionUpdateMany.mock.calls[0];
    expect(updateCall).toBeDefined();
    if (!updateCall) throw new Error('Expected session revocation update.');
    const [updateInput] = updateCall;
    expect(updateInput.where).toEqual({ revokedAt: null, userId });
    expect(updateInput.data.revokedAt).toBeInstanceOf(Date);
    expect(auditRecord).toHaveBeenCalledWith(
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
    const auditRecord = jest
      .fn<Promise<void>, [unknown, AuditWrite]>()
      .mockResolvedValue(undefined);
    const audit = auditService(auditRecord);
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
    expect(auditRecord).toHaveBeenCalledWith(
      transaction,
      expect.objectContaining({
        action: AUDIT_ACTIONS.ADMIN_BUSINESS_RESTORED,
      }),
    );
  });

  it('rejects a previously issued JWT when its session is revoked or user is no longer active', async () => {
    const findFirst = jest
      .fn<Promise<null>, [SessionFindFirstInput]>()
      .mockResolvedValue(null);
    const strategy = new JwtStrategy(
      { get: jest.fn().mockReturnValue('test-access-secret') } as never,
      { session: { findFirst } } as unknown as PrismaService,
    );
    await expect(strategy.validate(admin)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    const lookupCall = findFirst.mock.calls[0];
    expect(lookupCall).toBeDefined();
    if (!lookupCall) throw new Error('Expected active-session lookup.');
    const [lookupInput] = lookupCall;
    expect(lookupInput.where.revokedAt).toBeNull();
    expect(lookupInput.where.user).toEqual({ status: UserStatus.ACTIVE });
  });
});
