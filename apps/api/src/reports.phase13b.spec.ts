import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  BusinessStatus,
  ReportStatus,
  ReportTargetType,
  UserStatus,
} from '@prisma/client';
import { AuditService, AuditWrite } from './audit/audit.service';
import { PrismaService } from './prisma/prisma.service';
import { ReportsService } from './reports/reports.service';

const reporterId = '11111111-1111-4111-8111-111111111111';
const reportId = '22222222-2222-4222-8222-222222222222';
const adminId = '33333333-3333-4333-8333-333333333333';
const targetId = '44444444-4444-4444-8444-444444444444';

type AsyncMock<TResult, TArgs extends unknown[] = []> = jest.Mock<
  Promise<TResult>,
  TArgs
>;

type ReportFixture = {
  assignedAdmin: null;
  assignedAdminUserId: string | null;
  createdAt: Date;
  details: string | null;
  id: string;
  reason: string;
  reporter: {
    email: string;
    id: string;
    profile: { firstName: string | null; lastName: string | null };
    status: UserStatus;
  };
  reporterUserId: string;
  resolution: string | null;
  resolvedAt: Date | null;
  status: ReportStatus;
  targetId: string;
  targetType: ReportTargetType;
  updatedAt: Date;
};

type ReportTransactionInput =
  readonly Promise<unknown>[] | ((tx: ReportPrismaFixture) => Promise<unknown>);
type ReportCreateInput = {
  data: {
    details?: string;
    reason: string;
    reporterUserId: string;
    targetId: string;
    targetType: ReportTargetType;
  };
  select: { createdAt: true; id: true; status: true };
};
type ReportUpdateManyInput = {
  data: {
    assignedAdminUserId: string;
    resolution: string | null;
    resolvedAt: Date | null;
    status: ReportStatus;
  };
  where: { id: string; status: ReportStatus };
};

type ReportPrismaFixture = {
  $transaction: jest.Mock<Promise<unknown>, [ReportTransactionInput]>;
  business: {
    findFirst: AsyncMock<
      { id: string; name: string; status: BusinessStatus } | null,
      [unknown]
    >;
  };
  report: {
    count: AsyncMock<number, [unknown]>;
    create: AsyncMock<
      { createdAt: Date; id: string; status: ReportStatus },
      [ReportCreateInput]
    >;
    findFirst: AsyncMock<{ id: string } | null, [unknown]>;
    findMany: AsyncMock<ReportFixture[], [unknown]>;
    findUnique: AsyncMock<ReportFixture | null, [unknown]>;
    groupBy: AsyncMock<unknown[], [unknown]>;
    updateMany: AsyncMock<{ count: number }, [ReportUpdateManyInput]>;
  };
  review: {
    findFirst: AsyncMock<null, [unknown]>;
    groupBy: AsyncMock<unknown[], [unknown]>;
  };
  service: {
    findFirst: AsyncMock<null, [unknown]>;
  };
  user: {
    findFirst: AsyncMock<{ id: string } | null, [unknown]>;
    findUnique: AsyncMock<null, [unknown]>;
  };
};

type AuditFixture = {
  recent: jest.Mock<
    Promise<ReturnType<AuditService['toSafeAudit']>[]>,
    [number?]
  >;
  record: jest.Mock<Promise<void>, [unknown, AuditWrite]>;
};

function record(status: ReportStatus = ReportStatus.OPEN): ReportFixture {
  return {
    id: reportId,
    reporterUserId: reporterId,
    targetType: ReportTargetType.BUSINESS,
    targetId,
    reason: 'Policy concern',
    details: 'Please review this.',
    status,
    assignedAdminUserId: status === ReportStatus.OPEN ? null : adminId,
    resolution: null,
    resolvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    reporter: {
      id: reporterId,
      email: 'traveler@example.com',
      status: UserStatus.ACTIVE,
      profile: { firstName: 'Traveler', lastName: 'One' },
    },
    assignedAdmin: null,
  };
}

function mockPrisma(updateCount = 1): ReportPrismaFixture {
  const prisma: ReportPrismaFixture = {
    user: {
      findFirst: jest
        .fn<Promise<{ id: string } | null>, [unknown]>()
        .mockResolvedValue({ id: reporterId }),
      findUnique: jest.fn<Promise<null>, [unknown]>().mockResolvedValue(null),
    },
    business: {
      findFirst: jest
        .fn<
          Promise<{ id: string; name: string; status: BusinessStatus } | null>,
          [unknown]
        >()
        .mockResolvedValue({
          id: targetId,
          name: 'Public Business',
          status: BusinessStatus.ACTIVE,
        }),
    },
    service: {
      findFirst: jest.fn<Promise<null>, [unknown]>().mockResolvedValue(null),
    },
    review: {
      findFirst: jest.fn<Promise<null>, [unknown]>().mockResolvedValue(null),
      groupBy: jest.fn<Promise<unknown[]>, [unknown]>().mockResolvedValue([]),
    },
    report: {
      create: jest
        .fn<
          Promise<{ createdAt: Date; id: string; status: ReportStatus }>,
          [ReportCreateInput]
        >()
        .mockResolvedValue({
          id: reportId,
          status: ReportStatus.OPEN,
          createdAt: new Date(),
        }),
      findFirst: jest
        .fn<Promise<{ id: string } | null>, [unknown]>()
        .mockResolvedValue(null),
      findMany: jest
        .fn<Promise<ReportFixture[]>, [unknown]>()
        .mockResolvedValue([record()]),
      findUnique: jest
        .fn<Promise<ReportFixture | null>, [unknown]>()
        .mockResolvedValue(record(ReportStatus.UNDER_REVIEW)),
      count: jest.fn<Promise<number>, [unknown]>().mockResolvedValue(1),
      groupBy: jest.fn<Promise<unknown[]>, [unknown]>().mockResolvedValue([]),
      updateMany: jest
        .fn<Promise<{ count: number }>, [ReportUpdateManyInput]>()
        .mockResolvedValue({ count: updateCount }),
    },
    $transaction: jest.fn<Promise<unknown>, [ReportTransactionInput]>(),
  };
  prisma.$transaction.mockImplementation((value) =>
    typeof value === 'function' ? value(prisma) : Promise.all(value),
  );
  return prisma;
}

function mockAudit(): AuditFixture {
  return {
    record: jest
      .fn<Promise<void>, [unknown, AuditWrite]>()
      .mockResolvedValue(undefined),
    recent: jest
      .fn<Promise<ReturnType<AuditService['toSafeAudit']>[]>, [number?]>()
      .mockResolvedValue([]),
  };
}

function reportsService(
  prisma: ReportPrismaFixture,
  audit: AuditFixture,
): ReportsService {
  return new ReportsService(
    prisma as unknown as PrismaService,
    audit as unknown as AuditService,
  );
}

describe('Phase 13B reports', () => {
  it('creates a report only for an active reporter and reportable target', async () => {
    const prisma = mockPrisma();
    const service = reportsService(prisma, mockAudit());
    await service.create(reporterId, {
      targetType: ReportTargetType.BUSINESS,
      targetId,
      reason: ' Policy concern ',
      details: ' Details ',
    });
    const createCall = prisma.report.create.mock.calls[0];
    expect(createCall).toBeDefined();
    if (!createCall) throw new Error('Expected report creation.');
    const [createInput] = createCall;
    expect(createInput.data.reporterUserId).toBe(reporterId);
    expect(createInput.data.reason).toBe('Policy concern');
    expect(createInput.data.details).toBe('Details');
  });

  it('rejects self reports and unknown targets', async () => {
    const prisma = mockPrisma();
    const service = reportsService(prisma, mockAudit());
    await expect(
      service.create(reporterId, {
        targetType: ReportTargetType.USER,
        targetId: reporterId,
        reason: 'Reason',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    prisma.business.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.create(reporterId, {
        targetType: ReportTargetType.BUSINESS,
        targetId,
        reason: 'Reason',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('prevents duplicate open reports', async () => {
    const prisma = mockPrisma();
    prisma.report.findFirst.mockResolvedValueOnce({ id: reportId });
    const service = reportsService(prisma, mockAudit());
    await expect(
      service.create(reporterId, {
        targetType: ReportTargetType.BUSINESS,
        targetId,
        reason: 'Reason',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('transitions open reports transactionally and audits the state change', async () => {
    const prisma = mockPrisma();
    const auditRecord = jest
      .fn<Promise<void>, [unknown, AuditWrite]>()
      .mockResolvedValue(undefined);
    const audit = {
      record: auditRecord,
      recent: jest
        .fn<Promise<ReturnType<AuditService['toSafeAudit']>[]>, [number?]>()
        .mockResolvedValue([]),
    } satisfies AuditFixture;
    const service = reportsService(prisma, audit);
    await service.startReview(reportId, adminId, {});
    const updateCall = prisma.report.updateMany.mock.calls[0];
    expect(updateCall).toBeDefined();
    if (!updateCall) throw new Error('Expected report state update.');
    const [updateInput] = updateCall;
    expect(updateInput.where).toEqual({
      id: reportId,
      status: ReportStatus.OPEN,
    });
    const auditCall = auditRecord.mock.calls[0];
    expect(auditCall).toBeDefined();
    if (!auditCall) throw new Error('Expected report audit entry.');
    const [transaction, auditWrite] = auditCall;
    expect(transaction).toBe(prisma);
    expect(auditWrite.entityId).toBe(reportId);
    expect(auditWrite.entityType).toBe('REPORT');
    expect(auditWrite.metadata).toMatchObject({
      previousStatus: ReportStatus.OPEN,
      nextStatus: ReportStatus.UNDER_REVIEW,
    });
  });
});
