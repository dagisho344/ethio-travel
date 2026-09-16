import { BadRequestException } from '@nestjs/common';
import {
  BookingStatus,
  BusinessStatus,
  BusinessVerificationSummary,
  PaymentRefundStatus,
  PaymentStatus,
  Prisma,
  ReportStatus,
  UserStatus,
} from '@prisma/client';
import { AUDIT_ACTIONS } from './audit/audit.constants';
import { AuditService, AuditWrite } from './audit/audit.service';
import { AdminService } from './admin/admin.service';
import { UpdatePlatformSettingsDto } from './admin/dto/admin.dto';
import { AuthenticatedUser } from './auth/authenticated-user';
import { PrismaService } from './prisma/prisma.service';

const actor: AuthenticatedUser = {
  email: 'admin@example.com',
  roles: ['ADMIN'],
  sessionId: 'session-id',
  sub: '11111111-1111-4111-8111-111111111111',
};

function asPrisma(value: Record<string, unknown>): PrismaService {
  return value as unknown as PrismaService;
}

function asAudit(
  record: jest.Mock<Promise<void>, [unknown, AuditWrite]>,
): AuditService {
  return { record } as unknown as AuditService;
}

describe('Phase 13C admin operations', () => {
  it('keeps payment analytics separated by currency and derives net from authoritative payment and refund aggregates', async () => {
    const paymentGroupBy = jest
      .fn()
      .mockResolvedValueOnce([
        { status: PaymentStatus.PAID, _count: { _all: 3 } },
      ])
      .mockResolvedValueOnce([
        { currency: 'ETB', _sum: { amount: new Prisma.Decimal('120.00') } },
        { currency: 'USD', _sum: { amount: new Prisma.Decimal('20.00') } },
      ]);
    const refundGroupBy = jest
      .fn()
      .mockResolvedValue([
        { currency: 'ETB', _sum: { amount: new Prisma.Decimal('20.00') } },
      ]);
    const auditRecord = jest
      .fn<Promise<void>, [unknown, AuditWrite]>()
      .mockResolvedValue(undefined);
    const prisma = asPrisma({
      booking: {
        count: jest.fn().mockResolvedValue(4),
        groupBy: jest.fn().mockResolvedValue([
          { bookingStatus: BookingStatus.PENDING, _count: { _all: 2 } },
          { bookingStatus: BookingStatus.CONFIRMED, _count: { _all: 3 } },
        ]),
      },
      business: {
        groupBy: jest
          .fn()
          .mockResolvedValueOnce([
            { status: BusinessStatus.ACTIVE, _count: { _all: 4 } },
          ])
          .mockResolvedValueOnce([
            {
              verificationSummary: BusinessVerificationSummary.VERIFIED,
              _count: { _all: 4 },
            },
          ]),
      },
      businessVerification: { count: jest.fn().mockResolvedValue(1) },
      destination: { count: jest.fn().mockResolvedValue(5) },
      payment: {
        groupBy: paymentGroupBy,
      },
      paymentRefund: {
        groupBy: refundGroupBy,
      },
      report: {
        groupBy: jest
          .fn()
          .mockResolvedValue([
            { status: ReportStatus.OPEN, _count: { _all: 2 } },
          ]),
      },
      review: { count: jest.fn().mockResolvedValue(7) },
      user: {
        count: jest.fn().mockResolvedValue(2),
        groupBy: jest
          .fn()
          .mockResolvedValue([
            { status: UserStatus.ACTIVE, _count: { _all: 8 } },
          ]),
      },
    });
    const service = new AdminService(prisma, asAudit(auditRecord));

    const result = await service.analytics();

    expect(result.payments.revenueByCurrency).toEqual([
      { currency: 'ETB', gross: '120', refunded: '20', net: '100' },
      { currency: 'USD', gross: '20', refunded: '0', net: '20' },
    ]);
    expect(result.bookings).toEqual(
      expect.objectContaining({ confirmed: 3, pending: 2, recentVolume: 4 }),
    );
    expect(paymentGroupBy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        by: ['currency'],
        where: {
          status: {
            in: [
              PaymentStatus.PAID,
              PaymentStatus.PARTIALLY_REFUNDED,
              PaymentStatus.REFUNDED,
            ],
          },
        },
      }),
    );
    expect(refundGroupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: PaymentRefundStatus.SUCCEEDED },
      }),
    );
  });

  it('writes only typed non-secret support settings and audits the changed field names transactionally', async () => {
    const settings = {
      id: '22222222-2222-4222-8222-222222222222',
      singletonKey: 'PRIMARY',
      supportEmail: 'support@ethiotravel.example',
      supportMessage: null,
      supportPhone: null,
      updatedAt: new Date('2030-01-01T00:00:00.000Z'),
    };
    const transaction = {
      platformSettings: {
        create: jest.fn().mockResolvedValue(settings),
        findUnique: jest.fn().mockResolvedValue(null),
        update: jest.fn(),
      },
    };
    const prisma = asPrisma({
      $transaction: jest.fn(
        (callback: (tx: typeof transaction) => Promise<unknown>) =>
          callback(transaction),
      ),
    });
    const record = jest
      .fn<Promise<void>, [unknown, AuditWrite]>()
      .mockResolvedValue(undefined);
    const service = new AdminService(prisma, asAudit(record));
    const dto: UpdatePlatformSettingsDto = {
      supportEmail: 'support@ethiotravel.example',
    };

    await expect(service.updateSettings(actor, dto, {})).resolves.toEqual({
      supportEmail: 'support@ethiotravel.example',
      supportMessage: null,
      supportPhone: null,
      updatedAt: settings.updatedAt,
    });
    expect(transaction.platformSettings.create).toHaveBeenCalledWith({
      data: {
        singletonKey: 'PRIMARY',
        supportEmail: 'support@ethiotravel.example',
      },
    });
    const auditCall = record.mock.calls[0];
    expect(auditCall).toBeDefined();
    if (!auditCall) throw new Error('Expected settings audit record.');
    const [auditTransaction, auditWrite] = auditCall;
    expect(auditTransaction).toBe(transaction);
    expect(auditWrite).toEqual(
      expect.objectContaining({
        action: AUDIT_ACTIONS.ADMIN_SYSTEM_SETTINGS_UPDATED,
        metadata: { settingNames: 'supportEmail' },
      }),
    );
    expect(auditWrite.metadata).toEqual({ settingNames: 'supportEmail' });
    expect(auditWrite.metadata).not.toHaveProperty('supportEmail');
  });

  it('rejects an empty settings update rather than creating a generic configuration store', async () => {
    const service = new AdminService({} as PrismaService, {} as AuditService);
    await expect(service.updateSettings(actor, {}, {})).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
