import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  UserRestriction,
  UserRestrictionCapability,
  UserStatus,
} from '@prisma/client';
import { AuditContext, AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../audit/audit.constants';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { PrismaService } from '../prisma/prisma.service';
import {
  LiftUserRestrictionDto,
  RestrictUserDto,
} from './dto/user-restriction.dto';

export function restrictionIsActive(
  restriction: Pick<UserRestriction, 'liftedAt' | 'expiresAt'>,
  now: Date,
): boolean {
  return (
    restriction.liftedAt === null &&
    (restriction.expiresAt === null || restriction.expiresAt > now)
  );
}

@Injectable()
export class UserRestrictionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async listForAdmin(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found.');
    const now = new Date();
    const rows = await this.prisma.userRestriction.findMany({
      where: { userId },
      orderBy: { capability: 'asc' },
    });
    return rows.map((row) => this.toAdminResponse(row, now));
  }

  async restrict(
    actor: AuthenticatedUser,
    userId: string,
    dto: RestrictUserDto,
    context: AuditContext,
  ) {
    const reason = this.requiredReason(dto.reason);
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (expiresAt && !Number.isFinite(expiresAt.getTime())) {
      throw new BadRequestException('Expiry must be a valid ISO timestamp.');
    }
    return this.prisma.$transaction(async (tx) => {
      // The parent row serializes restrict/restrict, restrict/lift, and
      // re-restriction after expiry even when no restriction row exists yet.
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`,
      );
      const target = await tx.user.findUnique({
        where: { id: userId },
        select: {
          status: true,
          roles: {
            where: { role: { name: 'ADMIN' } },
            select: { roleId: true },
          },
        },
      });
      if (!target) throw new NotFoundException('User not found.');
      if (target.roles.length) {
        throw new ForbiddenException('Admin users cannot be restricted.');
      }
      if (target.status !== UserStatus.ACTIVE) {
        throw new ConflictException('Only active users can be restricted.');
      }
      const now = new Date();
      if (expiresAt && expiresAt <= now) {
        throw new BadRequestException('Expiry must be in the future.');
      }
      const existing = await tx.userRestriction.findUnique({
        where: { userId_capability: { userId, capability: dto.capability } },
      });
      if (existing && restrictionIsActive(existing, now)) {
        throw new ConflictException('Capability is already restricted.');
      }
      const row = await tx.userRestriction.upsert({
        where: { userId_capability: { userId, capability: dto.capability } },
        create: {
          userId,
          capability: dto.capability,
          reason,
          restrictedByUserId: actor.sub,
          restrictedAt: now,
          expiresAt,
        },
        update: {
          reason,
          restrictedByUserId: actor.sub,
          restrictedAt: now,
          expiresAt,
          liftedAt: null,
          liftedByUserId: null,
          liftReason: null,
        },
      });
      await this.audit.record(tx, {
        ...context,
        action: AUDIT_ACTIONS.ADMIN_USER_RESTRICTED,
        actorUserId: actor.sub,
        entityType: AUDIT_ENTITY_TYPES.USER,
        entityId: userId,
        metadata: {
          targetUserId: userId,
          capability: dto.capability,
          expiresAt: expiresAt?.toISOString() ?? null,
        },
        reason,
      });
      return this.toAdminResponse(row, now);
    });
  }

  async lift(
    actor: AuthenticatedUser,
    userId: string,
    capability: UserRestrictionCapability,
    dto: LiftUserRestrictionDto,
    context: AuditContext,
  ) {
    const reason = this.requiredReason(dto.reason);
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE`,
      );
      const target = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (!target) throw new NotFoundException('User not found.');
      const existing = await tx.userRestriction.findUnique({
        where: { userId_capability: { userId, capability } },
      });
      const now = new Date();
      if (!existing || !restrictionIsActive(existing, now)) {
        throw new ConflictException('No active restriction to lift.');
      }
      const row = await tx.userRestriction.update({
        where: { userId_capability: { userId, capability } },
        data: { liftedAt: now, liftedByUserId: actor.sub, liftReason: reason },
      });
      await this.audit.record(tx, {
        ...context,
        action: AUDIT_ACTIONS.ADMIN_USER_RESTRICTION_LIFTED,
        actorUserId: actor.sub,
        entityType: AUDIT_ENTITY_TYPES.USER,
        entityId: userId,
        metadata: { targetUserId: userId, capability },
        reason,
      });
      return this.toAdminResponse(row, now);
    });
  }

  async isRestricted(
    userId: string,
    capability: UserRestrictionCapability,
  ): Promise<boolean> {
    const now = new Date();
    const row = await this.prisma.userRestriction.findFirst({
      where: {
        userId,
        capability,
        liftedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
      },
      select: { id: true },
    });
    return row !== null;
  }

  async assertAllowed(
    userId: string,
    capability: UserRestrictionCapability,
  ): Promise<void> {
    if (await this.isRestricted(userId, capability)) {
      throw new ForbiddenException({
        statusCode: 403,
        error: 'Forbidden',
        message: 'This capability is restricted.',
        code: 'USER_CAPABILITY_RESTRICTED',
        capability,
      });
    }
  }

  private requiredReason(value: string): string {
    const reason = typeof value === 'string' ? value.trim() : '';
    if (!reason || reason.length > 1000) {
      throw new BadRequestException(
        'A reason of 1–1000 characters is required.',
      );
    }
    return reason;
  }

  private toAdminResponse(row: UserRestriction, now: Date) {
    return {
      id: row.id,
      capability: row.capability,
      active: restrictionIsActive(row, now),
      reason: row.reason,
      restrictedAt: row.restrictedAt,
      restrictedByUserId: row.restrictedByUserId,
      expiresAt: row.expiresAt,
      liftedAt: row.liftedAt,
      liftedByUserId: row.liftedByUserId,
      liftReason: row.liftReason,
    };
  }
}
