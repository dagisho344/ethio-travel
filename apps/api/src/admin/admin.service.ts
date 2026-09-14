import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BusinessStatus,
  Prisma,
  UserStatus,
  VerificationRequestStatus,
} from '@prisma/client';
import { AuditContext, AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../audit/audit.constants';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { paginate, PaginatedResponse } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AdminActionReasonDto, AdminUsersQueryDto } from './dto/admin.dto';

const adminUserInclude = {
  profile: true,
  roles: { include: { role: true } },
  _count: {
    select: {
      businessMembers: true,
    },
  },
} satisfies Prisma.UserInclude;

type AdminUserRecord = Prisma.UserGetPayload<{
  include: typeof adminUserInclude;
}>;

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async dashboard() {
    const [
      userGroups,
      businessGroups,
      verificationGroups,
      recentUsers,
      recentBusinesses,
      recentActions,
    ] = await Promise.all([
      this.prisma.user.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.business.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.businessVerification.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.user.findMany({
        include: { profile: true },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
      this.prisma.business.findMany({
        include: { category: true, city: true },
        orderBy: { createdAt: 'desc' },
        take: 6,
      }),
      this.audit.recent(6),
    ]);

    return {
      businesses: {
        active: this.groupCount(businessGroups, BusinessStatus.ACTIVE),
        draft: this.groupCount(businessGroups, BusinessStatus.DRAFT),
        suspended: this.groupCount(businessGroups, BusinessStatus.SUSPENDED),
        total: businessGroups.reduce(
          (total, item) => total + item._count._all,
          0,
        ),
      },
      recent: {
        adminActions: recentActions,
        businesses: recentBusinesses.map((business) => ({
          category: business.category.name,
          city: business.city.name,
          createdAt: business.createdAt,
          id: business.id,
          name: business.name,
          status: business.status,
          verificationSummary: business.verificationSummary,
        })),
        users: recentUsers.map((user) => ({
          createdAt: user.createdAt,
          email: user.email,
          firstName: user.profile?.firstName ?? null,
          id: user.id,
          lastName: user.profile?.lastName ?? null,
          status: user.status,
        })),
      },
      users: {
        active: this.groupCount(userGroups, UserStatus.ACTIVE),
        deactivated: this.groupCount(userGroups, UserStatus.DEACTIVATED),
        suspended: this.groupCount(userGroups, UserStatus.SUSPENDED),
        total: userGroups.reduce((total, item) => total + item._count._all, 0),
      },
      verifications: {
        approved: this.groupCount(
          verificationGroups,
          VerificationRequestStatus.APPROVED,
        ),
        pending: this.groupCount(
          verificationGroups,
          VerificationRequestStatus.PENDING,
        ),
        rejected: this.groupCount(
          verificationGroups,
          VerificationRequestStatus.REJECTED,
        ),
      },
    };
  }

  async listUsers(
    query: AdminUsersQueryDto,
  ): Promise<PaginatedResponse<ReturnType<AdminService['toListUser']>>> {
    const where: Prisma.UserWhereInput = {
      status: query.status,
      roles: query.role ? { some: { role: { name: query.role } } } : undefined,
      OR: query.q
        ? [
            { email: { contains: query.q, mode: 'insensitive' } },
            {
              profile: {
                firstName: { contains: query.q, mode: 'insensitive' },
              },
            },
            {
              profile: { lastName: { contains: query.q, mode: 'insensitive' } },
            },
          ]
        : undefined,
    };
    const orderBy = {
      [query.sort]: query.order,
    } as Prisma.UserOrderByWithRelationInput;
    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        include: adminUserInclude,
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginate(
      users.map((user) => this.toListUser(user)),
      total,
      query.page,
      query.limit,
    );
  }

  async findUserById(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        profile: true,
        roles: { include: { role: true } },
        businessMembers: {
          include: {
            business: {
              select: {
                id: true,
                name: true,
                status: true,
                verificationSummary: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
        _count: {
          select: {
            bookingsAuthored: true,
            reviewsAuthored: true,
            trips: true,
          },
        },
      },
    });
    if (!user) throw new NotFoundException('User not found.');
    return {
      bookingCount: user._count.bookingsAuthored,
      businessMembershipCount: user.businessMembers.length,
      businessMemberships: user.businessMembers.map((membership) => ({
        business: membership.business,
        createdAt: membership.createdAt,
        role: membership.role,
        status: membership.status,
      })),
      createdAt: user.createdAt,
      email: user.email,
      firstName: user.profile?.firstName ?? null,
      id: user.id,
      lastName: user.profile?.lastName ?? null,
      reviewCount: user._count.reviewsAuthored,
      roles: user.roles.map((assignment) => assignment.role.name),
      status: user.status,
      tripCount: user._count.trips,
    };
  }

  async suspendUser(
    actor: AuthenticatedUser,
    userId: string,
    dto: AdminActionReasonDto,
    context: AuditContext,
  ) {
    if (actor.sub === userId) {
      throw new ForbiddenException('Administrators cannot suspend themselves.');
    }
    const reason = this.requiredReason(dto.reason);
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, status: true },
      });
      if (!target) throw new NotFoundException('User not found.');
      if (target.status !== UserStatus.ACTIVE) {
        throw new ConflictException('Only active users can be suspended.');
      }
      const changed = await tx.user.updateMany({
        where: { id: userId, status: UserStatus.ACTIVE },
        data: { status: UserStatus.SUSPENDED },
      });
      if (changed.count !== 1) {
        throw new ConflictException(
          'User status changed. Refresh and try again.',
        );
      }
      await tx.session.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await this.audit.record(tx, {
        ...context,
        action: AUDIT_ACTIONS.ADMIN_USER_SUSPENDED,
        actorUserId: actor.sub,
        entityId: userId,
        entityType: AUDIT_ENTITY_TYPES.USER,
        metadata: {
          nextStatus: UserStatus.SUSPENDED,
          previousStatus: UserStatus.ACTIVE,
        },
        reason,
      });
      return { id: userId, status: UserStatus.SUSPENDED };
    });
  }

  async restoreUser(
    actor: AuthenticatedUser,
    userId: string,
    dto: AdminActionReasonDto,
    context: AuditContext,
  ) {
    const reason = this.requiredReason(dto.reason);
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, status: true },
      });
      if (!target) throw new NotFoundException('User not found.');
      if (target.status !== UserStatus.SUSPENDED) {
        throw new ConflictException('Only suspended users can be restored.');
      }
      const changed = await tx.user.updateMany({
        where: { id: userId, status: UserStatus.SUSPENDED },
        data: { status: UserStatus.ACTIVE },
      });
      if (changed.count !== 1) {
        throw new ConflictException(
          'User status changed. Refresh and try again.',
        );
      }
      await this.audit.record(tx, {
        ...context,
        action: AUDIT_ACTIONS.ADMIN_USER_RESTORED,
        actorUserId: actor.sub,
        entityId: userId,
        entityType: AUDIT_ENTITY_TYPES.USER,
        metadata: {
          nextStatus: UserStatus.ACTIVE,
          previousStatus: UserStatus.SUSPENDED,
        },
        reason,
      });
      return { id: userId, status: UserStatus.ACTIVE };
    });
  }

  private groupCount<T extends string>(
    records: Array<{ status: T; _count: { _all: number } }>,
    status: T,
  ): number {
    return records.find((record) => record.status === status)?._count._all ?? 0;
  }

  private requiredReason(value: string): string {
    const reason = value.trim();
    if (reason.length < 3 || reason.length > 1000) {
      throw new ConflictException(
        'A reason between 3 and 1000 characters is required.',
      );
    }
    return reason;
  }

  private toListUser(user: AdminUserRecord) {
    return {
      businessMembershipCount: user._count.businessMembers,
      createdAt: user.createdAt,
      email: user.email,
      firstName: user.profile?.firstName ?? null,
      id: user.id,
      lastName: user.profile?.lastName ?? null,
      roles: user.roles.map((assignment) => assignment.role.name),
      status: user.status,
    };
  }
}
