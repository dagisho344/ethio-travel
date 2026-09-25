import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, TripItemType, TripStatus, UserStatus } from '@prisma/client';
import { createSecureToken, hashToken } from '../auth/token.util';
import {
  publicAttractionWhere,
  publicBusinessWhere,
  publicDestinationWhere,
  publicServiceWhere,
} from '../common/utils/public-visibility.util';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTripShareDto, UpdateTripShareDto } from './dto/trip-share.dto';
import {
  TRIP_SHARE_MAX_ITEMS,
  TRIP_SHARE_TOKEN_BYTES,
} from './trip-share.constants';
import { TripShareRateLimiterService } from './trip-share-rate-limiter.service';

const shareableItemTypes = [
  TripItemType.DESTINATION,
  TripItemType.ATTRACTION,
  TripItemType.BUSINESS,
  TripItemType.SERVICE,
] as const;

const ownerTripSelect = Prisma.validator<Prisma.TripSelect>()({
  id: true,
  status: true,
  archivedAt: true,
});

const publicTripSelect = Prisma.validator<Prisma.TripSelect>()({
  id: true,
  title: true,
  startDate: true,
  endDate: true,
  status: true,
  archivedAt: true,
  primaryDestinationId: true,
});

type PublicTripRecord = Prisma.TripGetPayload<{
  select: typeof publicTripSelect;
}>;

type PublicCandidate = {
  tripDayId: string;
  type: TripItemType;
  destinationId: string | null;
  attractionId: string | null;
  businessId: string | null;
  serviceId: string | null;
  startTime: string | null;
  endTime: string | null;
  position: number;
};

@Injectable()
export class TripShareService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly limiter: TripShareRateLimiterService,
  ) {}

  async findOwnerShare(userId: string, tripId: string) {
    await this.ensureActiveUser(userId);
    const trip = await this.findOwnedTrip(userId, tripId);
    const share = await this.prisma.tripShare.findUnique({
      where: { tripId: trip.id },
      select: {
        createdAt: true,
        expiresAt: true,
        revokedAt: true,
        updatedAt: true,
      },
    });
    return this.toOwnerShare(share, trip);
  }

  async preview(userId: string, tripId: string) {
    await this.ensureActiveUser(userId);
    const trip = await this.findOwnedTrip(userId, tripId);
    this.assertShareMutable(trip);
    return this.publicProjection(await this.findPublicTrip(trip.id));
  }

  async create(userId: string, tripId: string, dto: CreateTripShareDto) {
    await this.ensureActiveUser(userId);
    const trip = await this.findOwnedTrip(userId, tripId);
    this.assertShareMutable(trip);
    const expiresAt = this.optionalFutureExpiration(dto.expiresAt);
    const token = createSecureToken(TRIP_SHARE_TOKEN_BYTES);
    const tokenHash = hashToken(token);

    try {
      const share = await this.prisma.$transaction(
        async (tx) => {
          const existing = await tx.tripShare.findUnique({
            where: { tripId: trip.id },
            select: { id: true },
          });
          if (existing) {
            throw new ConflictException(
              'A share-link record already exists. Regenerate it explicitly.',
            );
          }
          return tx.tripShare.create({
            data: { tripId: trip.id, tokenHash, expiresAt },
            select: { expiresAt: true },
          });
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      return { token, expiresAt: share.expiresAt };
    } catch (error) {
      this.throwShareConflict(error);
      throw error;
    }
  }

  async updateExpiration(
    userId: string,
    tripId: string,
    dto: UpdateTripShareDto,
  ) {
    await this.ensureActiveUser(userId);
    const trip = await this.findOwnedTrip(userId, tripId);
    this.assertShareMutable(trip);
    if (dto.expiresAt === undefined) {
      throw new BadRequestException('An expiration value is required.');
    }
    const expiresAt = this.optionalFutureExpiration(dto.expiresAt);
    const share = await this.prisma.tripShare.findUnique({
      where: { tripId: trip.id },
      select: { expiresAt: true, revokedAt: true },
    });
    if (!share) throw new NotFoundException('Trip share not found.');
    if (share.revokedAt || this.isExpired(share.expiresAt)) {
      throw new ConflictException(
        'Revoked or expired links must be regenerated instead of reactivated.',
      );
    }
    const updated = await this.prisma.tripShare.update({
      where: { tripId: trip.id },
      data: { expiresAt },
      select: {
        createdAt: true,
        expiresAt: true,
        revokedAt: true,
        updatedAt: true,
      },
    });
    return this.toOwnerShare(updated, trip);
  }

  async regenerate(userId: string, tripId: string, dto: CreateTripShareDto) {
    await this.ensureActiveUser(userId);
    const trip = await this.findOwnedTrip(userId, tripId);
    this.assertShareMutable(trip);
    const token = createSecureToken(TRIP_SHARE_TOKEN_BYTES);
    const tokenHash = hashToken(token);

    const share = await this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.tripShare.findUnique({
          where: { tripId: trip.id },
          select: { id: true, expiresAt: true },
        });
        if (!existing) throw new NotFoundException('Trip share not found.');
        const expiresAt = this.regeneratedExpiration(dto, existing.expiresAt);
        return tx.tripShare.update({
          where: { id: existing.id },
          data: { tokenHash, expiresAt, revokedAt: null },
          select: { expiresAt: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return { token, expiresAt: share.expiresAt };
  }

  async revoke(userId: string, tripId: string): Promise<void> {
    await this.ensureActiveUser(userId);
    await this.findOwnedTrip(userId, tripId);
    await this.prisma.tripShare.updateMany({
      where: { tripId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async resolve(token: string, remoteAddress: string | undefined) {
    const tokenHash = hashToken(token);
    await this.limiter.consume(tokenHash, remoteAddress);
    const share = await this.prisma.tripShare.findFirst({
      where: {
        tokenHash,
        revokedAt: null,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        trip: { status: { not: TripStatus.ARCHIVED }, archivedAt: null },
      },
      select: { trip: { select: publicTripSelect } },
    });
    if (!share) throw new NotFoundException('Shared trip not found.');
    return this.publicProjection(share.trip);
  }

  private async publicProjection(trip: PublicTripRecord) {
    const [primaryDestination, days, candidates] = await Promise.all([
      trip.primaryDestinationId
        ? this.prisma.destination.findFirst({
            where: {
              id: trip.primaryDestinationId,
              ...publicDestinationWhere(),
            },
            select: {
              name: true,
              city: {
                select: {
                  name: true,
                  region: { select: { name: true } },
                },
              },
            },
          })
        : Promise.resolve(null),
      this.prisma.tripDay.findMany({
        where: { tripId: trip.id },
        orderBy: { date: 'asc' },
        select: { id: true, date: true, dayNumber: true },
      }),
      this.prisma.tripItem.findMany({
        where: {
          tripDay: { tripId: trip.id },
          type: { in: [...shareableItemTypes] },
        },
        orderBy: [{ tripDay: { date: 'asc' } }, { position: 'asc' }],
        take: TRIP_SHARE_MAX_ITEMS + 1,
        select: {
          tripDayId: true,
          type: true,
          destinationId: true,
          attractionId: true,
          businessId: true,
          serviceId: true,
          startTime: true,
          endTime: true,
          position: true,
        },
      }),
    ]);

    const truncated = candidates.length > TRIP_SHARE_MAX_ITEMS;
    const shareCandidates: PublicCandidate[] = candidates.slice(
      0,
      TRIP_SHARE_MAX_ITEMS,
    );
    const [destinations, attractions, businesses, services] = await Promise.all(
      [
        this.publicNames(
          'destination',
          shareCandidates.flatMap((item) =>
            item.destinationId ? [item.destinationId] : [],
          ),
        ),
        this.publicNames(
          'attraction',
          shareCandidates.flatMap((item) =>
            item.attractionId ? [item.attractionId] : [],
          ),
        ),
        this.publicNames(
          'business',
          shareCandidates.flatMap((item) =>
            item.businessId ? [item.businessId] : [],
          ),
        ),
        this.publicNames(
          'service',
          shareCandidates.flatMap((item) =>
            item.serviceId ? [item.serviceId] : [],
          ),
        ),
      ],
    );
    const titleByTarget = {
      destination: new Map(destinations.map((item) => [item.id, item.name])),
      attraction: new Map(attractions.map((item) => [item.id, item.name])),
      business: new Map(businesses.map((item) => [item.id, item.name])),
      service: new Map(services.map((item) => [item.id, item.name])),
    };
    const itemsByDay = new Map<
      string,
      Array<{
        type: PublicCandidate['type'];
        title: string;
        startTime: string | null;
        endTime: string | null;
      }>
    >();
    for (const item of shareCandidates) {
      const title = this.publicItemTitle(item, titleByTarget);
      if (!title) continue;
      const current = itemsByDay.get(item.tripDayId) ?? [];
      current.push({
        type: item.type,
        title,
        startTime: item.startTime,
        endTime: item.endTime,
      });
      itemsByDay.set(item.tripDayId, current);
    }

    return {
      title: trip.title,
      startDate: this.dateOnly(trip.startDate),
      endDate: this.dateOnly(trip.endDate),
      destinations: primaryDestination
        ? [
            {
              name: primaryDestination.name,
              cityName: primaryDestination.city.name,
              regionName: primaryDestination.city.region.name,
            },
          ]
        : [],
      days: days.map((day) => ({
        date: this.dateOnly(day.date),
        dayNumber: day.dayNumber,
        items: itemsByDay.get(day.id) ?? [],
      })),
      truncated,
    };
  }

  private async publicNames(
    type: 'destination' | 'attraction' | 'business' | 'service',
    ids: string[],
  ): Promise<Array<{ id: string; name: string }>> {
    const uniqueIds = [...new Set(ids)];
    if (!uniqueIds.length) return [];
    if (type === 'destination') {
      return this.prisma.destination.findMany({
        where: { id: { in: uniqueIds }, ...publicDestinationWhere() },
        select: { id: true, name: true },
      });
    }
    if (type === 'attraction') {
      return this.prisma.attraction.findMany({
        where: { id: { in: uniqueIds }, ...publicAttractionWhere() },
        select: { id: true, name: true },
      });
    }
    if (type === 'business') {
      return this.prisma.business.findMany({
        where: { id: { in: uniqueIds }, ...publicBusinessWhere() },
        select: { id: true, name: true },
      });
    }
    return this.prisma.service.findMany({
      where: { id: { in: uniqueIds }, ...publicServiceWhere() },
      select: { id: true, name: true },
    });
  }

  private publicItemTitle(
    item: PublicCandidate,
    titleByTarget: {
      destination: Map<string, string>;
      attraction: Map<string, string>;
      business: Map<string, string>;
      service: Map<string, string>;
    },
  ): string | undefined {
    if (item.type === TripItemType.DESTINATION && item.destinationId)
      return titleByTarget.destination.get(item.destinationId);
    if (item.type === TripItemType.ATTRACTION && item.attractionId)
      return titleByTarget.attraction.get(item.attractionId);
    if (item.type === TripItemType.BUSINESS && item.businessId)
      return titleByTarget.business.get(item.businessId);
    if (item.type === TripItemType.SERVICE && item.serviceId)
      return titleByTarget.service.get(item.serviceId);
    return undefined;
  }

  private async findPublicTrip(tripId: string): Promise<PublicTripRecord> {
    const trip = await this.prisma.trip.findFirst({
      where: { id: tripId },
      select: publicTripSelect,
    });
    if (!trip) throw new NotFoundException('Trip not found.');
    return trip;
  }

  private async findOwnedTrip(userId: string, tripId: string) {
    const trip = await this.prisma.trip.findFirst({
      where: { id: tripId, userId },
      select: ownerTripSelect,
    });
    if (!trip) throw new NotFoundException('Trip not found.');
    return trip;
  }

  private async ensureActiveUser(userId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: UserStatus.ACTIVE },
      select: { id: true },
    });
    if (!user) throw new UnauthorizedException('Authentication required.');
  }

  private assertShareMutable(trip: {
    status: TripStatus;
    archivedAt: Date | null;
  }): void {
    if (trip.status === TripStatus.ARCHIVED || trip.archivedAt) {
      throw new ConflictException(
        'Archived trips cannot create, update, or regenerate share links.',
      );
    }
  }

  private optionalFutureExpiration(
    value: string | null | undefined,
  ): Date | null {
    if (value === undefined || value === null) return null;
    const expiresAt = new Date(value);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
      throw new BadRequestException('Share expiration must be in the future.');
    }
    return expiresAt;
  }

  private regeneratedExpiration(
    dto: CreateTripShareDto,
    currentExpiration: Date | null,
  ): Date | null {
    if (dto.expiresAt !== undefined)
      return this.optionalFutureExpiration(dto.expiresAt);
    return this.isExpired(currentExpiration) ? null : currentExpiration;
  }

  private isExpired(expiresAt: Date | null): boolean {
    return Boolean(expiresAt && expiresAt <= new Date());
  }

  private toOwnerShare(
    share: {
      createdAt: Date;
      expiresAt: Date | null;
      revokedAt: Date | null;
      updatedAt: Date;
    } | null,
    trip: { status: TripStatus; archivedAt: Date | null },
  ) {
    const archived =
      trip.status === TripStatus.ARCHIVED || Boolean(trip.archivedAt);
    const expired = Boolean(share && this.isExpired(share.expiresAt));
    return {
      state: archived
        ? 'ARCHIVED'
        : !share
          ? 'NONE'
          : share.revokedAt
            ? 'REVOKED'
            : expired
              ? 'EXPIRED'
              : 'ACTIVE',
      canCreateOrRegenerate: !archived,
      canRevoke: Boolean(share && !share.revokedAt),
      expiresAt: share?.expiresAt ?? null,
      revokedAt: share?.revokedAt ?? null,
      createdAt: share?.createdAt ?? null,
      updatedAt: share?.updatedAt ?? null,
    };
  }

  private dateOnly(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private throwShareConflict(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'A share-link record was created concurrently. Refresh and try again.',
      );
    }
  }
}
