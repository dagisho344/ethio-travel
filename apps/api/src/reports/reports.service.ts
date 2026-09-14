import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  ReportStatus,
  ReportTargetType,
  ReviewStatus,
  UserStatus,
} from '@prisma/client';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../audit/audit.constants';
import { AuditContext, AuditService } from '../audit/audit.service';
import {
  publicBusinessWhere,
  publicServiceWhere,
} from '../common/utils/public-visibility.util';
import { paginate, PaginatedResponse } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AdminReportQueryDto } from './dto/admin-report-query.dto';
import { AdminReportResolutionDto } from './dto/admin-report-resolution.dto';
import { CreateReportDto } from './dto/create-report.dto';

const reportInclude = {
  reporter: {
    select: {
      id: true,
      email: true,
      status: true,
      profile: { select: { firstName: true, lastName: true } },
    },
  },
  assignedAdmin: {
    select: {
      id: true,
      email: true,
      profile: { select: { firstName: true, lastName: true } },
    },
  },
} satisfies Prisma.ReportInclude;

type ReportRecord = Prisma.ReportGetPayload<{ include: typeof reportInclude }>;
type ReportTargetSummary =
  | { id: string; name: string; status: string; type: ReportTargetType }
  | { id: string; rating: number; status: string; type: ReportTargetType }
  | { displayName: string; id: string; status: string; type: ReportTargetType }
  | null;

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(reporterUserId: string, dto: CreateReportDto) {
    await this.ensureActiveReporter(reporterUserId);
    if (
      dto.targetType === ReportTargetType.USER &&
      dto.targetId === reporterUserId
    ) {
      throw new BadRequestException('You cannot report your own account.');
    }
    await this.ensureReportableTarget(dto.targetType, dto.targetId);
    const reason = this.requiredText(dto.reason, 120, 'Report reason');
    const details = this.optionalText(dto.details, 2000);
    const duplicate = await this.prisma.report.findFirst({
      where: {
        reporterUserId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason,
        status: { in: [ReportStatus.OPEN, ReportStatus.UNDER_REVIEW] },
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new ConflictException('This report is already under review.');
    }
    const report = await this.prisma.report.create({
      data: {
        reporterUserId,
        targetType: dto.targetType,
        targetId: dto.targetId,
        reason,
        details,
      },
      select: { id: true, status: true, createdAt: true },
    });
    return report;
  }

  async listAdmin(
    query: AdminReportQueryDto,
  ): Promise<PaginatedResponse<ReturnType<ReportsService['toListItem']>>> {
    if (query.from && query.to && query.from > query.to) {
      throw new BadRequestException(
        'Report start date must be before end date.',
      );
    }
    const where: Prisma.ReportWhereInput = {
      reporterUserId: query.reporterUserId,
      status: query.status,
      targetType: query.targetType,
      createdAt:
        query.from || query.to ? { gte: query.from, lte: query.to } : undefined,
      OR: query.q
        ? [
            { reason: { contains: query.q, mode: 'insensitive' } },
            { details: { contains: query.q, mode: 'insensitive' } },
          ]
        : undefined,
    };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.report.findMany({
        where,
        include: reportInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.report.count({ where }),
    ]);
    return paginate(
      records.map((record) => this.toListItem(record)),
      total,
      query.page,
      query.limit,
    );
  }

  async findAdminById(reportId: string) {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: reportInclude,
    });
    if (!report) throw new NotFoundException('Report not found.');
    return {
      ...this.toListItem(report),
      details: report.details,
      target: await this.targetSummary(
        report.targetType,
        report.targetId,
        false,
      ),
    };
  }

  async startReview(
    reportId: string,
    adminUserId: string,
    context: AuditContext,
  ) {
    return this.transition(
      reportId,
      ReportStatus.OPEN,
      ReportStatus.UNDER_REVIEW,
      adminUserId,
      undefined,
      context,
      AUDIT_ACTIONS.ADMIN_REPORT_REVIEW_STARTED,
    );
  }

  async resolve(
    reportId: string,
    adminUserId: string,
    dto: AdminReportResolutionDto,
    context: AuditContext,
  ) {
    return this.transition(
      reportId,
      ReportStatus.UNDER_REVIEW,
      ReportStatus.RESOLVED,
      adminUserId,
      this.requiredText(dto.resolution, 1000, 'Resolution'),
      context,
      AUDIT_ACTIONS.ADMIN_REPORT_RESOLVED,
    );
  }

  async dismiss(
    reportId: string,
    adminUserId: string,
    dto: AdminReportResolutionDto,
    context: AuditContext,
  ) {
    return this.transition(
      reportId,
      ReportStatus.UNDER_REVIEW,
      ReportStatus.DISMISSED,
      adminUserId,
      this.requiredText(dto.resolution, 1000, 'Resolution'),
      context,
      AUDIT_ACTIONS.ADMIN_REPORT_DISMISSED,
    );
  }

  async moderationSummary() {
    const [reportGroups, reviewGroups, recentActions] = await Promise.all([
      this.prisma.report.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.review.groupBy({ by: ['status'], _count: { _all: true } }),
      this.audit.recent(20),
    ]);
    const reportCount = (status: ReportStatus) =>
      reportGroups.find((group) => group.status === status)?._count._all ?? 0;
    const reviewCount = (status: ReviewStatus) =>
      reviewGroups.find((group) => group.status === status)?._count._all ?? 0;
    return {
      reports: {
        open: reportCount(ReportStatus.OPEN),
        underReview: reportCount(ReportStatus.UNDER_REVIEW),
        resolved: reportCount(ReportStatus.RESOLVED),
        dismissed: reportCount(ReportStatus.DISMISSED),
      },
      reviews: {
        pending: reviewCount(ReviewStatus.PENDING),
        hidden: reviewCount(ReviewStatus.HIDDEN),
      },
      recentActions: recentActions.filter(
        (action) =>
          action.action.startsWith('ADMIN_REVIEW_') ||
          action.action.startsWith('ADMIN_REPORT_'),
      ),
    };
  }

  private async transition(
    reportId: string,
    previousStatus: ReportStatus,
    nextStatus: ReportStatus,
    adminUserId: string,
    resolution: string | undefined,
    context: AuditContext,
    action:
      | typeof AUDIT_ACTIONS.ADMIN_REPORT_REVIEW_STARTED
      | typeof AUDIT_ACTIONS.ADMIN_REPORT_RESOLVED
      | typeof AUDIT_ACTIONS.ADMIN_REPORT_DISMISSED,
  ) {
    await this.prisma.$transaction(async (tx) => {
      const update = await tx.report.updateMany({
        where: { id: reportId, status: previousStatus },
        data: {
          status: nextStatus,
          assignedAdminUserId: adminUserId,
          resolution: resolution ?? null,
          resolvedAt:
            nextStatus === ReportStatus.RESOLVED ||
            nextStatus === ReportStatus.DISMISSED
              ? new Date()
              : null,
        },
      });
      if (update.count !== 1) {
        const existing = await tx.report.findUnique({
          where: { id: reportId },
          select: { id: true },
        });
        if (!existing) throw new NotFoundException('Report not found.');
        throw new ConflictException(
          'Report is not in a valid state for this action.',
        );
      }
      await this.audit.record(tx, {
        ...context,
        action,
        actorUserId: adminUserId,
        entityId: reportId,
        entityType: AUDIT_ENTITY_TYPES.REPORT,
        metadata: {
          nextStatus,
          previousStatus,
          reportId,
        },
        reason: resolution,
      });
    });
    return this.findAdminById(reportId);
  }

  private async ensureActiveReporter(userId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: UserStatus.ACTIVE },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found.');
  }

  private async ensureReportableTarget(
    type: ReportTargetType,
    id: string,
  ): Promise<void> {
    const exists = await this.targetSummary(type, id);
    if (!exists) throw new NotFoundException('Report target not found.');
  }

  private async targetSummary(
    type: ReportTargetType,
    id: string,
    requirePublicEligibility = true,
  ): Promise<ReportTargetSummary> {
    switch (type) {
      case ReportTargetType.BUSINESS: {
        const business = await this.prisma.business.findFirst({
          where: requirePublicEligibility
            ? { id, ...publicBusinessWhere() }
            : { id },
          select: { id: true, name: true, status: true },
        });
        return business ? { ...business, type } : null;
      }
      case ReportTargetType.SERVICE: {
        const service = await this.prisma.service.findFirst({
          where: requirePublicEligibility
            ? { id, ...publicServiceWhere() }
            : { id },
          select: { id: true, name: true, status: true },
        });
        return service ? { ...service, type } : null;
      }
      case ReportTargetType.REVIEW: {
        const review = await this.prisma.review.findFirst({
          where: requirePublicEligibility
            ? { id, status: ReviewStatus.PUBLISHED }
            : { id },
          select: { id: true, rating: true, status: true },
        });
        return review ? { ...review, type } : null;
      }
      case ReportTargetType.USER: {
        const user = await this.prisma.user.findUnique({
          where: { id },
          select: {
            id: true,
            status: true,
            email: true,
            profile: { select: { firstName: true, lastName: true } },
          },
        });
        if (!user) return null;
        const name = [user.profile?.firstName, user.profile?.lastName]
          .filter(Boolean)
          .join(' ');
        return {
          displayName: name || user.email,
          id: user.id,
          status: user.status,
          type,
        };
      }
    }
  }

  private toListItem(report: ReportRecord) {
    return {
      assignedAdmin: report.assignedAdmin
        ? {
            displayName: this.displayName(report.assignedAdmin),
            id: report.assignedAdmin.id,
          }
        : null,
      createdAt: report.createdAt,
      id: report.id,
      reason: report.reason,
      reporter: {
        displayName: this.displayName(report.reporter),
        id: report.reporter.id,
        status: report.reporter.status,
      },
      resolution: report.resolution,
      resolvedAt: report.resolvedAt,
      status: report.status,
      targetId: report.targetId,
      targetType: report.targetType,
      updatedAt: report.updatedAt,
    };
  }

  private displayName(user: {
    email: string;
    profile: { firstName: string | null; lastName: string | null } | null;
  }): string {
    const name = [user.profile?.firstName, user.profile?.lastName]
      .filter(Boolean)
      .join(' ');
    return name || user.email;
  }

  private requiredText(value: string, max: number, label: string): string {
    const text = value.trim();
    if (text.length < 3 || text.length > max) {
      throw new BadRequestException(
        `${label} must be between 3 and ${max} characters.`,
      );
    }
    return text;
  }

  private optionalText(
    value: string | undefined,
    max: number,
  ): string | undefined {
    if (!value) return undefined;
    const text = value.trim();
    if (!text) return undefined;
    if (text.length > max)
      throw new BadRequestException(
        `Details must not exceed ${max} characters.`,
      );
    return text;
  }
}
