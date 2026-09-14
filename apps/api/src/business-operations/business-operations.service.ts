import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BookingStatus,
  BusinessMemberRole,
  PaymentRefundStatus,
  PaymentTransactionStatus,
  PaymentTransactionType,
  Prisma,
  ReviewStatus,
  ServiceStatus,
} from '@prisma/client';
import { BusinessesService } from '../businesses/businesses.service';
import { paginate, PaginatedResponse } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import {
  BusinessReviewQueryDto,
  UpsertBusinessReviewResponseDto,
} from './dto/business-operations.dto';

const readableRoles = [
  BusinessMemberRole.OWNER,
  BusinessMemberRole.MANAGER,
  BusinessMemberRole.STAFF,
];
const writableRoles = [BusinessMemberRole.OWNER, BusinessMemberRole.MANAGER];
const cancelledStatuses = [
  BookingStatus.CANCELLED_BY_TRAVELER,
  BookingStatus.CANCELLED_BY_BUSINESS,
];

type RevenueTotal = {
  currency: string;
  gross: string;
  refunded: string;
  net: string;
};

type CustomerAggregate = {
  total: number;
  completed: number;
  latest: Date | null;
};

@Injectable()
export class BusinessOperationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessesService,
  ) {}

  async dashboard(userId: string, businessId: string) {
    await this.businesses.requireMembership(userId, businessId, readableRoles);
    const now = new Date();
    const reviewWhere = this.businessReviewWhere(businessId);
    const [
      business,
      primaryLocation,
      totalServices,
      activeServices,
      pendingBookings,
      confirmedUpcoming,
      completedBookings,
      cancelledBookings,
      publishedReviewAggregate,
      unansweredReviews,
      captured,
      refunded,
    ] = await Promise.all([
      this.prisma.business.findUnique({
        where: { id: businessId },
        select: {
          id: true,
          name: true,
          status: true,
          verificationSummary: true,
          city: { select: { id: true, name: true } },
          destination: { select: { id: true, name: true } },
        },
      }),
      this.prisma.businessLocation.findFirst({
        where: { businessId, isPrimary: true, status: 'ACTIVE' },
        select: {
          id: true,
          label: true,
          addressLine1: true,
          city: { select: { id: true, name: true } },
          destination: { select: { id: true, name: true } },
        },
      }),
      this.prisma.service.count({
        where: { businessId, status: { not: ServiceStatus.ARCHIVED } },
      }),
      this.prisma.service.count({
        where: { businessId, status: ServiceStatus.PUBLISHED },
      }),
      this.prisma.booking.count({
        where: { businessId, bookingStatus: BookingStatus.PENDING },
      }),
      this.prisma.booking.count({
        where: {
          businessId,
          bookingStatus: BookingStatus.CONFIRMED,
          startAt: { gte: now },
        },
      }),
      this.prisma.booking.count({
        where: { businessId, bookingStatus: BookingStatus.COMPLETED },
      }),
      this.prisma.booking.count({
        where: { businessId, bookingStatus: { in: cancelledStatuses } },
      }),
      this.prisma.review.aggregate({
        where: { ...reviewWhere, status: ReviewStatus.PUBLISHED },
        _avg: { rating: true },
        _count: { _all: true },
      }),
      this.prisma.review.count({
        where: {
          ...reviewWhere,
          status: ReviewStatus.PUBLISHED,
          responses: { none: { archivedAt: null } },
        },
      }),
      this.prisma.paymentTransaction.groupBy({
        by: ['currency'],
        where: {
          type: PaymentTransactionType.PAYMENT_CAPTURED,
          status: PaymentTransactionStatus.SUCCEEDED,
          payment: { businessId },
        },
        _sum: { amount: true },
      }),
      this.prisma.paymentRefund.groupBy({
        by: ['currency'],
        where: {
          status: PaymentRefundStatus.SUCCEEDED,
          payment: { businessId },
        },
        _sum: { amount: true },
      }),
    ]);
    if (!business) throw new NotFoundException('Business not found.');

    return {
      business,
      primaryLocation,
      services: { total: totalServices, active: activeServices },
      bookings: {
        pending: pendingBookings,
        confirmedUpcoming,
        completed: completedBookings,
        cancelled: cancelledBookings,
      },
      reviews: {
        averageRating:
          publishedReviewAggregate._avg.rating === null
            ? null
            : Math.round(publishedReviewAggregate._avg.rating * 10) / 10,
        publishedCount: publishedReviewAggregate._count._all,
        unansweredCount: unansweredReviews,
      },
      revenue: this.revenueTotals(captured, refunded),
    };
  }

  async customers(
    userId: string,
    businessId: string,
    query: { page: number; limit: number },
  ): Promise<
    PaginatedResponse<{
      userId: string;
      displayName: string;
      bookingCount: number;
      mostRecentBookingAt: Date | null;
      upcomingBookingCount: number;
      completedBookingCount: number;
    }>
  > {
    await this.businesses.requireMembership(userId, businessId, readableRoles);
    const now = new Date();
    const [groups, upcoming] = await Promise.all([
      this.prisma.booking.groupBy({
        by: ['travelerId', 'bookingStatus'],
        where: { businessId },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
      this.prisma.booking.groupBy({
        by: ['travelerId'],
        where: {
          businessId,
          bookingStatus: BookingStatus.CONFIRMED,
          startAt: { gte: now },
        },
        _count: { _all: true },
      }),
    ]);
    const aggregate = new Map<string, CustomerAggregate>();
    for (const group of groups) {
      const current = aggregate.get(group.travelerId) ?? {
        total: 0,
        completed: 0,
        latest: null,
      };
      current.total += group._count._all;
      if (group.bookingStatus === BookingStatus.COMPLETED) {
        current.completed += group._count._all;
      }
      if (
        group._max.createdAt &&
        (!current.latest || group._max.createdAt > current.latest)
      ) {
        current.latest = group._max.createdAt;
      }
      aggregate.set(group.travelerId, current);
    }
    const upcomingByTraveler = new Map(
      upcoming.map((group) => [group.travelerId, group._count._all]),
    );
    const ordered = [...aggregate.entries()].sort(
      ([, left], [, right]) =>
        (right.latest?.getTime() ?? 0) - (left.latest?.getTime() ?? 0),
    );
    const pageEntries = ordered.slice(
      (query.page - 1) * query.limit,
      query.page * query.limit,
    );
    const users = await this.prisma.user.findMany({
      where: { id: { in: pageEntries.map(([travelerId]) => travelerId) } },
      select: {
        id: true,
        profile: { select: { firstName: true, lastName: true } },
      },
    });
    const usersById = new Map(users.map((user) => [user.id, user]));
    return paginate(
      pageEntries.map(([travelerId, summary]) => ({
        userId: travelerId,
        displayName: this.displayName(usersById.get(travelerId)),
        bookingCount: summary.total,
        mostRecentBookingAt: summary.latest,
        upcomingBookingCount: upcomingByTraveler.get(travelerId) ?? 0,
        completedBookingCount: summary.completed,
      })),
      ordered.length,
      query.page,
      query.limit,
    );
  }

  async customer(userId: string, businessId: string, travelerId: string) {
    await this.businesses.requireMembership(userId, businessId, readableRoles);
    const [traveler, bookings] = await Promise.all([
      this.prisma.user.findFirst({
        where: {
          id: travelerId,
          bookingsAuthored: { some: { businessId } },
        },
        select: {
          id: true,
          profile: { select: { firstName: true, lastName: true } },
        },
      }),
      this.prisma.booking.findMany({
        where: { businessId, travelerId },
        select: {
          id: true,
          reference: true,
          startAt: true,
          endAt: true,
          bookingStatus: true,
          paymentStatus: true,
          quantity: true,
          subtotal: true,
          currency: true,
          service: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    if (!traveler) throw new NotFoundException('Customer not found.');
    return {
      userId: traveler.id,
      displayName: this.displayName(traveler),
      bookings,
    };
  }

  async reviews(
    userId: string,
    businessId: string,
    query: BusinessReviewQueryDto,
  ) {
    await this.businesses.requireMembership(userId, businessId, readableRoles);
    const where: Prisma.ReviewWhereInput = {
      ...this.businessReviewWhere(businessId),
      status: query.status,
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.review.findMany({
        where,
        select: {
          id: true,
          rating: true,
          title: true,
          body: true,
          status: true,
          publishedAt: true,
          createdAt: true,
          service: { select: { id: true, name: true } },
          author: {
            select: {
              profile: { select: { firstName: true, lastName: true } },
            },
          },
          responses: {
            where: { businessId, archivedAt: null },
            select: { id: true, body: true, createdAt: true, updatedAt: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.review.count({ where }),
    ]);
    return paginate(
      data.map((review) => ({
        ...review,
        author: { displayName: this.displayName(review.author) },
        businessResponse: review.responses[0] ?? null,
      })),
      total,
      query.page,
      query.limit,
    );
  }

  async upsertReviewResponse(
    userId: string,
    businessId: string,
    reviewId: string,
    dto: UpsertBusinessReviewResponseDto,
  ) {
    await this.businesses.requireMembership(userId, businessId, writableRoles);
    const body = dto.body.trim();
    if (!body) throw new BadRequestException('A response body is required.');
    const review = await this.prisma.review.findFirst({
      where: {
        id: reviewId,
        status: ReviewStatus.PUBLISHED,
        ...this.businessReviewWhere(businessId),
      },
      select: { id: true },
    });
    if (!review)
      throw new NotFoundException('Published business review not found.');
    return this.prisma.reviewResponse.upsert({
      where: { reviewId_businessId: { reviewId, businessId } },
      create: { reviewId, businessId, authorUserId: userId, body },
      update: { body, authorUserId: userId, archivedAt: null },
      select: { id: true, body: true, createdAt: true, updatedAt: true },
    });
  }

  private businessReviewWhere(businessId: string): Prisma.ReviewWhereInput {
    return { OR: [{ businessId }, { service: { businessId } }] };
  }

  private revenueTotals(
    captured: Array<{
      currency: string;
      _sum: { amount: Prisma.Decimal | null };
    }>,
    refunded: Array<{
      currency: string;
      _sum: { amount: Prisma.Decimal | null };
    }>,
  ): RevenueTotal[] {
    const totals = new Map<
      string,
      { gross: Prisma.Decimal; refunded: Prisma.Decimal }
    >();
    for (const group of captured) {
      const current = totals.get(group.currency) ?? {
        gross: new Prisma.Decimal(0),
        refunded: new Prisma.Decimal(0),
      };
      current.gross = current.gross.add(group._sum.amount ?? 0);
      totals.set(group.currency, current);
    }
    for (const group of refunded) {
      const current = totals.get(group.currency) ?? {
        gross: new Prisma.Decimal(0),
        refunded: new Prisma.Decimal(0),
      };
      current.refunded = current.refunded.add(group._sum.amount ?? 0);
      totals.set(group.currency, current);
    }
    return [...totals.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([currency, total]) => ({
        currency,
        gross: total.gross.toFixed(2),
        refunded: total.refunded.toFixed(2),
        net: total.gross.sub(total.refunded).toFixed(2),
      }));
  }

  private displayName(
    user:
      | {
          profile: { firstName: string | null; lastName: string | null } | null;
        }
      | undefined,
  ): string {
    const names = [
      user?.profile?.firstName?.trim(),
      user?.profile?.lastName?.trim(),
    ].filter((name): name is string => Boolean(name));
    return names.join(' ') || 'Traveler';
  }
}
