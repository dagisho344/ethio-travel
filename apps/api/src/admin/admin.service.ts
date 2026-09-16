import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  BusinessStatus,
  BusinessVerificationSummary,
  PaymentRefundStatus,
  PaymentStatus,
  Prisma,
  PublicationStatus,
  ReportStatus,
  ReviewStatus,
  UserStatus,
  VerificationRequestStatus,
} from '@prisma/client';
import { AuditContext, AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '../audit/audit.constants';
import { AuthenticatedUser } from '../auth/authenticated-user';
import { paginate, PaginatedResponse } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  AdminActionReasonDto,
  AdminUsersQueryDto,
  UpdatePlatformSettingsDto,
} from './dto/admin.dto';

const PLATFORM_SETTINGS_KEY = 'PRIMARY';
const capturedPaymentStatuses = [
  PaymentStatus.PAID,
  PaymentStatus.PARTIALLY_REFUNDED,
  PaymentStatus.REFUNDED,
];

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

  async analytics() {
    const recentSince = new Date();
    recentSince.setUTCDate(recentSince.getUTCDate() - 30);
    const [
      userGroups,
      recentRegistrations,
      businessGroups,
      businessVerificationGroups,
      bookingGroups,
      recentBookingVolume,
      paymentGroups,
      capturedByCurrency,
      refundedByCurrency,
      publishedDestinations,
      publishedReviews,
      reportGroups,
      pendingVerifications,
    ] = await Promise.all([
      this.prisma.user.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.user.count({ where: { createdAt: { gte: recentSince } } }),
      this.prisma.business.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.business.groupBy({
        by: ['verificationSummary'],
        _count: { _all: true },
      }),
      this.prisma.booking.groupBy({
        by: ['bookingStatus'],
        _count: { _all: true },
      }),
      this.prisma.booking.count({ where: { createdAt: { gte: recentSince } } }),
      this.prisma.payment.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.payment.groupBy({
        by: ['currency'],
        where: { status: { in: capturedPaymentStatuses } },
        _sum: { amount: true },
      }),
      this.prisma.paymentRefund.groupBy({
        by: ['currency'],
        where: { status: PaymentRefundStatus.SUCCEEDED },
        _sum: { amount: true },
      }),
      this.prisma.destination.count({
        where: { status: PublicationStatus.PUBLISHED },
      }),
      this.prisma.review.count({ where: { status: ReviewStatus.PUBLISHED } }),
      this.prisma.report.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.businessVerification.count({
        where: { status: VerificationRequestStatus.PENDING },
      }),
    ]);

    return {
      businesses: {
        active: this.groupCount(businessGroups, BusinessStatus.ACTIVE),
        draft: this.groupCount(businessGroups, BusinessStatus.DRAFT),
        pendingVerification: this.groupCountBy(
          businessVerificationGroups,
          'verificationSummary',
          BusinessVerificationSummary.PENDING,
        ),
        rejectedVerification: this.groupCountBy(
          businessVerificationGroups,
          'verificationSummary',
          BusinessVerificationSummary.REJECTED,
        ),
        suspended: this.groupCount(businessGroups, BusinessStatus.SUSPENDED),
        total: this.totalCount(businessGroups),
        verified: this.groupCountBy(
          businessVerificationGroups,
          'verificationSummary',
          BusinessVerificationSummary.VERIFIED,
        ),
      },
      bookings: {
        cancelled:
          this.groupCountBy(
            bookingGroups,
            'bookingStatus',
            BookingStatus.CANCELLED_BY_BUSINESS,
          ) +
          this.groupCountBy(
            bookingGroups,
            'bookingStatus',
            BookingStatus.CANCELLED_BY_TRAVELER,
          ),
        completed: this.groupCountBy(
          bookingGroups,
          'bookingStatus',
          BookingStatus.COMPLETED,
        ),
        confirmed: this.groupCountBy(
          bookingGroups,
          'bookingStatus',
          BookingStatus.CONFIRMED,
        ),
        pending: this.groupCountBy(
          bookingGroups,
          'bookingStatus',
          BookingStatus.PENDING,
        ),
        recentVolume: recentBookingVolume,
        total: this.totalCount(bookingGroups),
      },
      content: {
        openReports: this.groupCount(reportGroups, ReportStatus.OPEN),
        pendingVerifications,
        publishedDestinations,
        publishedReviews,
      },
      payments: {
        byStatus: {
          failed: this.groupCount(paymentGroups, PaymentStatus.FAILED),
          paid: this.groupCount(paymentGroups, PaymentStatus.PAID),
          partiallyRefunded: this.groupCount(
            paymentGroups,
            PaymentStatus.PARTIALLY_REFUNDED,
          ),
          pending: this.groupCount(paymentGroups, PaymentStatus.PENDING),
          refunded: this.groupCount(paymentGroups, PaymentStatus.REFUNDED),
        },
        revenueByCurrency: this.currencyTotals(
          capturedByCurrency,
          refundedByCurrency,
        ),
      },
      users: {
        active: this.groupCount(userGroups, UserStatus.ACTIVE),
        deactivated: this.groupCount(userGroups, UserStatus.DEACTIVATED),
        recentRegistrations,
        suspended: this.groupCount(userGroups, UserStatus.SUSPENDED),
        total: this.totalCount(userGroups),
      },
    };
  }

  async settings() {
    const settings = await this.prisma.platformSettings.findUnique({
      where: { singletonKey: PLATFORM_SETTINGS_KEY },
    });
    return this.toSettings(settings);
  }

  async updateSettings(
    actor: AuthenticatedUser,
    dto: UpdatePlatformSettingsDto,
    context: AuditContext,
  ) {
    const data = this.settingsData(dto);
    const settingNames = Object.keys(data);
    if (!settingNames.length) {
      throw new BadRequestException('At least one setting is required.');
    }
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.platformSettings.findUnique({
        where: { singletonKey: PLATFORM_SETTINGS_KEY },
      });
      const settings = existing
        ? await tx.platformSettings.update({
            where: { id: existing.id },
            data,
          })
        : await tx.platformSettings.create({
            data: { singletonKey: PLATFORM_SETTINGS_KEY, ...data },
          });
      await this.audit.record(tx, {
        ...context,
        action: AUDIT_ACTIONS.ADMIN_SYSTEM_SETTINGS_UPDATED,
        actorUserId: actor.sub,
        entityId: settings.id,
        entityType: AUDIT_ENTITY_TYPES.PLATFORM_SETTINGS,
        metadata: { settingNames: settingNames.join(',') },
      });
      return this.toSettings(settings);
    });
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
    value: T,
  ): number {
    return records.find((record) => record.status === value)?._count._all ?? 0;
  }

  private groupCountBy<T extends string, K extends string>(
    records: Array<Record<K, T> & { _count: { _all: number } }>,
    property: K,
    value: T,
  ): number {
    return (
      records.find((record) => record[property] === value)?._count._all ?? 0
    );
  }

  private totalCount(records: Array<{ _count: { _all: number } }>): number {
    return records.reduce((total, item) => total + item._count._all, 0);
  }

  private currencyTotals(
    captured: Array<{
      currency: string;
      _sum: { amount: Prisma.Decimal | null };
    }>,
    refunded: Array<{
      currency: string;
      _sum: { amount: Prisma.Decimal | null };
    }>,
  ) {
    const totals = new Map<
      string,
      { gross: Prisma.Decimal; refunded: Prisma.Decimal }
    >();
    for (const item of captured) {
      totals.set(item.currency, {
        gross: item._sum.amount ?? new Prisma.Decimal(0),
        refunded: new Prisma.Decimal(0),
      });
    }
    for (const item of refunded) {
      const current = totals.get(item.currency) ?? {
        gross: new Prisma.Decimal(0),
        refunded: new Prisma.Decimal(0),
      };
      current.refunded = item._sum.amount ?? new Prisma.Decimal(0);
      totals.set(item.currency, current);
    }
    return [...totals.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([currency, totalsForCurrency]) => ({
        currency,
        gross: totalsForCurrency.gross.toString(),
        net: totalsForCurrency.gross.sub(totalsForCurrency.refunded).toString(),
        refunded: totalsForCurrency.refunded.toString(),
      }));
  }

  private settingsData(dto: UpdatePlatformSettingsDto): {
    supportEmail?: string | null;
    supportMessage?: string | null;
    supportPhone?: string | null;
  } {
    const data: {
      supportEmail?: string | null;
      supportMessage?: string | null;
      supportPhone?: string | null;
    } = {};
    if (dto.supportEmail !== undefined) data.supportEmail = dto.supportEmail;
    if (dto.supportPhone !== undefined) data.supportPhone = dto.supportPhone;
    if (dto.supportMessage !== undefined)
      data.supportMessage = dto.supportMessage;
    return data;
  }

  private toSettings(
    settings: {
      supportEmail: string | null;
      supportMessage: string | null;
      supportPhone: string | null;
      updatedAt: Date;
    } | null,
  ) {
    return {
      supportEmail: settings?.supportEmail ?? null,
      supportMessage: settings?.supportMessage ?? null,
      supportPhone: settings?.supportPhone ?? null,
      updatedAt: settings?.updatedAt ?? null,
    };
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
