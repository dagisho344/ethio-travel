/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { ReportStatus, ReportTargetType, UserStatus } from '@prisma/client';
import { ReportsService } from './reports/reports.service';

const reporterId = '11111111-1111-4111-8111-111111111111';
const reportId = '22222222-2222-4222-8222-222222222222';
const adminId = '33333333-3333-4333-8333-333333333333';
const targetId = '44444444-4444-4444-8444-444444444444';

function record(status: ReportStatus = ReportStatus.OPEN): any {
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

function mockPrisma(updateCount = 1): any {
  const prisma: any = {
    user: {
      findFirst: jest.fn(() => Promise.resolve({ id: reporterId })),
      findUnique: jest.fn(() => Promise.resolve(null)),
    },
    business: {
      findFirst: jest.fn(() =>
        Promise.resolve({
          id: targetId,
          name: 'Public Business',
          status: 'ACTIVE',
        }),
      ),
    },
    service: { findFirst: jest.fn() },
    review: {
      findFirst: jest.fn(),
      groupBy: jest.fn(() => Promise.resolve([])),
    },
    report: {
      create: jest.fn(() =>
        Promise.resolve({
          id: reportId,
          status: ReportStatus.OPEN,
          createdAt: new Date(),
        }),
      ),
      findFirst: jest.fn(() => Promise.resolve(null)),
      findMany: jest.fn(() => Promise.resolve([record()])),
      findUnique: jest.fn(() =>
        Promise.resolve(record(ReportStatus.UNDER_REVIEW)),
      ),
      count: jest.fn(() => Promise.resolve(1)),
      groupBy: jest.fn(() => Promise.resolve([])),
      updateMany: jest.fn(() => Promise.resolve({ count: updateCount })),
    },
  };
  prisma.$transaction = jest.fn((value: any) =>
    Array.isArray(value) ? Promise.all(value) : value(prisma),
  );
  return prisma;
}

describe('Phase 13B reports', () => {
  it('creates a report only for an active reporter and reportable target', async () => {
    const prisma = mockPrisma();
    const service = new ReportsService(prisma, {
      record: jest.fn(),
      recent: jest.fn(),
    } as any);
    await service.create(reporterId, {
      targetType: ReportTargetType.BUSINESS,
      targetId,
      reason: ' Policy concern ',
      details: ' Details ',
    });
    expect(prisma.report.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reporterUserId: reporterId,
          reason: 'Policy concern',
          details: 'Details',
        }),
      }),
    );
  });

  it('rejects self reports and unknown targets', async () => {
    const prisma = mockPrisma();
    const service = new ReportsService(prisma, {
      record: jest.fn(),
      recent: jest.fn(),
    } as any);
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
    const service = new ReportsService(prisma, {
      record: jest.fn(),
      recent: jest.fn(),
    } as any);
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
    const audit = {
      record: jest.fn(),
      recent: jest.fn(() => Promise.resolve([])),
    };
    const service = new ReportsService(prisma, audit as any);
    await service.startReview(reportId, adminId, {});
    expect(prisma.report.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: reportId, status: ReportStatus.OPEN },
      }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      prisma,
      expect.objectContaining({
        entityId: reportId,
        entityType: 'REPORT',
        metadata: expect.objectContaining({
          previousStatus: ReportStatus.OPEN,
          nextStatus: ReportStatus.UNDER_REVIEW,
        }),
      }),
    );
  });
});
