import { BadRequestException, Injectable } from '@nestjs/common';
import { AuditOutcome, Prisma } from '@prisma/client';
import { paginate, PaginatedResponse } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditAction, AuditEntityType } from './audit.constants';
import { AuditQueryDto } from './dto/audit-query.dto';

const SAFE_METADATA_KEYS = new Set([
  'operation',
  'previousStatus',
  'nextStatus',
  'verificationStatus',
  'categoryType',
  'destinationId',
  'reviewId',
  'reportId',
  'targetType',
]);

type SafeMetadataValue = boolean | null | number | string;
export type AuditMetadata = Record<string, SafeMetadataValue>;

export type AuditContext = {
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
};

export type AuditWrite = AuditContext & {
  action: AuditAction;
  actorUserId?: string;
  entityId?: string;
  entityType: AuditEntityType;
  metadata?: AuditMetadata;
  outcome?: AuditOutcome;
  reason?: string;
};

const auditInclude = {
  actor: {
    include: { profile: true },
  },
} satisfies Prisma.AuditLogInclude;

type AuditRecord = Prisma.AuditLogGetPayload<{ include: typeof auditInclude }>;

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(tx: Prisma.TransactionClient, input: AuditWrite): Promise<void> {
    await tx.auditLog.create({
      data: {
        action: input.action,
        actorUserId: input.actorUserId ?? null,
        correlationId: this.bounded(input.correlationId, 128),
        entityId: input.entityId ?? null,
        entityType: input.entityType,
        ipAddress: this.bounded(input.ipAddress, 64),
        metadata: this.safeMetadata(input.metadata),
        outcome: input.outcome ?? AuditOutcome.SUCCESS,
        reason: this.bounded(input.reason, 1000),
        userAgent: this.bounded(input.userAgent, 512),
      },
    });
  }

  async list(
    query: AuditQueryDto,
  ): Promise<PaginatedResponse<ReturnType<AuditService['toSafeAudit']>>> {
    if (query.from && query.to && query.from > query.to) {
      throw new BadRequestException(
        'Audit start date must be before end date.',
      );
    }
    const where: Prisma.AuditLogWhereInput = {
      action: query.action,
      actorUserId: query.actorUserId,
      entityId: query.entityId,
      entityType: query.entityType,
      createdAt:
        query.from || query.to ? { gte: query.from, lte: query.to } : undefined,
    };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: auditInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginate(
      records.map((record) => this.toSafeAudit(record)),
      total,
      query.page,
      query.limit,
    );
  }

  async recent(limit = 6): Promise<ReturnType<AuditService['toSafeAudit']>[]> {
    const records = await this.prisma.auditLog.findMany({
      include: auditInclude,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 20),
    });
    return records.map((record) => this.toSafeAudit(record));
  }

  async recentForEntity(
    entityType: AuditEntityType,
    entityId: string,
    limit = 6,
  ): Promise<ReturnType<AuditService['toSafeAudit']>[]> {
    const records = await this.prisma.auditLog.findMany({
      where: { entityId, entityType },
      include: auditInclude,
      orderBy: { createdAt: 'desc' },
      take: Math.min(Math.max(limit, 1), 20),
    });
    return records.map((record) => this.toSafeAudit(record));
  }
  toSafeAudit(record: AuditRecord) {
    return {
      id: record.id,
      actor: record.actor
        ? {
            email: record.actor.email,
            firstName: record.actor.profile?.firstName ?? null,
            id: record.actor.id,
            lastName: record.actor.profile?.lastName ?? null,
          }
        : null,
      action: record.action,
      createdAt: record.createdAt,
      entityId: record.entityId,
      entityType: record.entityType,
      metadata: record.metadata,
      outcome: record.outcome,
      reason: record.reason,
    };
  }

  private bounded(value: string | undefined, maxLength: number): string | null {
    const text = value?.trim();
    return text ? text.slice(0, maxLength) : null;
  }

  private safeMetadata(
    metadata: AuditMetadata | undefined,
  ): Prisma.InputJsonValue | undefined {
    if (!metadata) return undefined;
    const entries = Object.entries(metadata).filter(
      ([key, value]) =>
        SAFE_METADATA_KEYS.has(key) &&
        (typeof value === 'string' ||
          typeof value === 'number' ||
          typeof value === 'boolean' ||
          value === null),
    );
    return entries.length
      ? (Object.fromEntries(entries) as Prisma.InputJsonValue)
      : undefined;
  }
}
