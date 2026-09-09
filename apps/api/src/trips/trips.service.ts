import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, TripItemType, TripStatus, UserStatus } from '@prisma/client';
import { paginate } from '../common/dto/pagination.dto';
import {
  publicAttractionWhere,
  publicBusinessWhere,
  publicDestinationWhere,
  publicServiceWhere,
} from '../common/utils/public-visibility.util';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTripDto,
  CreateTripItemDto,
  ReorderTripItemsDto,
  TripQueryDto,
  TripSort,
  TripTimingFilter,
  UpdateTripDayDto,
  UpdateTripDto,
  UpdateTripItemDto,
} from './dto/trip.dto';

const MAX_TRIP_DAYS = 90;
const dateOnlyPattern = /^\d{4}-\d{2}-\d{2}$/;
const timePattern = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

type TripClient = Prisma.TransactionClient | PrismaService;

const itemSelect = Prisma.validator<Prisma.TripItemSelect>()({
  id: true,
  type: true,
  destinationId: true,
  attractionId: true,
  businessId: true,
  serviceId: true,
  bookingId: true,
  titleSnapshot: true,
  startTime: true,
  endTime: true,
  position: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  booking: {
    select: {
      id: true,
      reference: true,
      startAt: true,
      endAt: true,
      subtotal: true,
      currency: true,
      bookingStatus: true,
      paymentStatus: true,
      service: { select: { id: true, name: true, slug: true } },
      business: { select: { id: true, name: true, slug: true } },
    },
  },
});

const daySelect = Prisma.validator<Prisma.TripDaySelect>()({
  id: true,
  date: true,
  dayNumber: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  items: { orderBy: { position: 'asc' }, select: itemSelect },
});

const tripDetailSelect = Prisma.validator<Prisma.TripSelect>()({
  id: true,
  userId: true,
  title: true,
  startDate: true,
  endDate: true,
  status: true,
  notes: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  originCity: { select: { id: true, name: true, slug: true } },
  destinationCity: { select: { id: true, name: true, slug: true } },
  primaryDestination: { select: { id: true, name: true, slug: true } },
  days: { orderBy: { date: 'asc' }, select: daySelect },
});

const tripListSelect = Prisma.validator<Prisma.TripSelect>()({
  id: true,
  title: true,
  startDate: true,
  endDate: true,
  status: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  originCity: { select: { id: true, name: true, slug: true } },
  destinationCity: { select: { id: true, name: true, slug: true } },
  primaryDestination: { select: { id: true, name: true, slug: true } },
  _count: { select: { days: true } },
});

type TripDetailRecord = Prisma.TripGetPayload<{
  select: typeof tripDetailSelect;
}>;
type TripListRecord = Prisma.TripGetPayload<{
  select: typeof tripListSelect;
}>;
type TripDayRecord = Prisma.TripDayGetPayload<{
  select: typeof daySelect;
}>;
type TripItemRecord = Prisma.TripItemGetPayload<{
  select: typeof itemSelect;
}>;

type ItemTarget = {
  titleSnapshot: string;
  destinationId: string | null;
  attractionId: string | null;
  businessId: string | null;
  serviceId: string | null;
  bookingId: string | null;
};

@Injectable()
export class TripsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateTripDto) {
    await this.ensureActiveUser(userId);
    const title = this.requiredText(dto.title, 'Trip title');
    const notes = this.optionalText(dto.notes);
    const range = this.dateRange(dto.startDate, dto.endDate);
    const status = this.planningStatus(dto.status ?? TripStatus.DRAFT);
    const locations = await this.resolveLocations(this.prisma, {
      originCityId: dto.originCityId ?? null,
      destinationCityId: dto.destinationCityId ?? null,
      primaryDestinationId: dto.primaryDestinationId ?? null,
      validatePrimaryDestination: Boolean(dto.primaryDestinationId),
    });

    const created = await this.prisma.$transaction(
      async (tx) => {
        const trip = await tx.trip.create({
          data: {
            userId,
            title,
            notes,
            status,
            startDate: range.start,
            endDate: range.end,
            ...locations,
          },
          select: { id: true },
        });
        await tx.tripDay.createMany({
          data: this.daysForRange(trip.id, range.start, range.end),
        });
        return tx.trip.findUniqueOrThrow({
          where: { id: trip.id },
          select: tripDetailSelect,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return this.toTrip(created);
  }

  async findMine(userId: string, query: TripQueryDto) {
    await this.ensureActiveUser(userId);
    const where: Prisma.TripWhereInput = {
      userId,
      ...this.statusWhere(query.status),
      ...this.timingWhere(query.timing),
    };
    const [records, total] = await Promise.all([
      this.prisma.trip.findMany({
        where,
        select: tripListSelect,
        orderBy: this.listOrder(query.sort),
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.trip.count({ where }),
    ]);
    return paginate(
      records.map((trip) => this.toTripList(trip)),
      total,
      query.page,
      query.limit,
    );
  }

  async findOne(userId: string, id: string) {
    await this.ensureActiveUser(userId);
    return this.toTrip(await this.findOwnedTrip(userId, id));
  }

  async update(userId: string, id: string, dto: UpdateTripDto) {
    await this.ensureActiveUser(userId);
    const existing = await this.findOwnedTripForUpdate(userId, id);
    this.assertMutable(existing.status);
    const range = this.dateRange(
      dto.startDate ?? this.dateOnly(existing.startDate),
      dto.endDate ?? this.dateOnly(existing.endDate),
    );
    const locations = await this.resolveLocations(this.prisma, {
      originCityId:
        dto.originCityId === undefined
          ? existing.originCityId
          : (dto.originCityId ?? null),
      destinationCityId:
        dto.destinationCityId === undefined
          ? existing.destinationCityId
          : (dto.destinationCityId ?? null),
      primaryDestinationId:
        dto.primaryDestinationId === undefined
          ? existing.primaryDestinationId
          : (dto.primaryDestinationId ?? null),
      validatePrimaryDestination:
        dto.primaryDestinationId !== undefined ||
        dto.destinationCityId !== undefined,
    });
    const title =
      dto.title === undefined
        ? existing.title
        : this.requiredText(dto.title, 'Trip title');
    const notes =
      dto.notes === undefined ? existing.notes : this.optionalText(dto.notes);
    const status =
      dto.status === undefined
        ? existing.status
        : this.planningStatus(dto.status);

    const trip = await this.prisma.$transaction(
      async (tx) => {
        await this.reconcileDays(tx, existing, range.start, range.end);
        return tx.trip.update({
          where: { id: existing.id },
          data: {
            title,
            notes,
            status,
            startDate: range.start,
            endDate: range.end,
            ...locations,
          },
          select: tripDetailSelect,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return this.toTrip(trip);
  }

  async archive(userId: string, id: string) {
    await this.ensureActiveUser(userId);
    const trip = await this.prisma.trip.updateMany({
      where: { id, userId, archivedAt: null },
      data: { status: TripStatus.ARCHIVED, archivedAt: new Date() },
    });
    if (trip.count !== 1) {
      const exists = await this.prisma.trip.findFirst({
        where: { id, userId },
        select: { id: true },
      });
      if (!exists) throw new NotFoundException('Trip not found.');
    }
    return this.findOne(userId, id);
  }

  async days(userId: string, tripId: string) {
    await this.ensureActiveUser(userId);
    await this.findOwnedTrip(userId, tripId);
    const days = await this.prisma.tripDay.findMany({
      where: { tripId },
      orderBy: { date: 'asc' },
      select: daySelect,
    });
    return days.map((day) => this.toDay(day));
  }

  async updateDay(
    userId: string,
    tripId: string,
    dayId: string,
    dto: UpdateTripDayDto,
  ) {
    await this.ensureActiveUser(userId);
    const day = await this.findOwnedDay(userId, tripId, dayId);
    this.assertMutable(day.trip.status);
    const updated = await this.prisma.tripDay.update({
      where: { id: day.id },
      data: {
        notes:
          dto.notes === undefined ? undefined : this.optionalText(dto.notes),
      },
      select: daySelect,
    });
    return this.toDay(updated);
  }

  async addItem(
    userId: string,
    tripId: string,
    dayId: string,
    dto: CreateTripItemDto,
  ) {
    await this.ensureActiveUser(userId);
    const day = await this.findOwnedDay(userId, tripId, dayId);
    this.assertMutable(day.trip.status);
    const times = this.times(dto.startTime, dto.endTime);

    const item = await this.prisma.$transaction(
      async (tx) => {
        const target = await this.resolveItemTarget(tx, userId, tripId, dto);
        const position = await tx.tripItem.count({
          where: { tripDayId: day.id },
        });
        return tx.tripItem.create({
          data: {
            tripDayId: day.id,
            type: dto.type,
            ...target,
            ...times,
            notes: this.optionalText(dto.notes),
            position,
          },
          select: itemSelect,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return this.toItem(item);
  }

  async updateItem(
    userId: string,
    tripId: string,
    dayId: string,
    itemId: string,
    dto: UpdateTripItemDto,
  ) {
    await this.ensureActiveUser(userId);
    const day = await this.findOwnedDay(userId, tripId, dayId);
    this.assertMutable(day.trip.status);
    const existing = await this.prisma.tripItem.findFirst({
      where: { id: itemId, tripDayId: day.id },
      select: itemSelect,
    });
    if (!existing) throw new NotFoundException('Trip item not found.');
    if (dto.title !== undefined && existing.type !== TripItemType.CUSTOM) {
      throw new BadRequestException(
        'Only custom itinerary items may change title.',
      );
    }
    const times = this.times(
      dto.startTime === undefined ? existing.startTime : dto.startTime,
      dto.endTime === undefined ? existing.endTime : dto.endTime,
    );
    const updated = await this.prisma.tripItem.update({
      where: { id: existing.id },
      data: {
        titleSnapshot:
          dto.title === undefined
            ? undefined
            : this.requiredText(dto.title, 'Custom item title'),
        ...times,
        notes:
          dto.notes === undefined ? undefined : this.optionalText(dto.notes),
      },
      select: itemSelect,
    });
    return this.toItem(updated);
  }

  async removeItem(
    userId: string,
    tripId: string,
    dayId: string,
    itemId: string,
  ) {
    await this.ensureActiveUser(userId);
    const day = await this.findOwnedDay(userId, tripId, dayId);
    this.assertMutable(day.trip.status);
    await this.prisma.$transaction(async (tx) => {
      const item = await tx.tripItem.findFirst({
        where: { id: itemId, tripDayId: day.id },
        select: { id: true, position: true },
      });
      if (!item) throw new NotFoundException('Trip item not found.');
      await tx.tripItem.delete({ where: { id: item.id } });
      await tx.tripItem.updateMany({
        where: { tripDayId: day.id, position: { gt: item.position } },
        data: { position: { decrement: 1 } },
      });
    });
  }

  async reorderItems(
    userId: string,
    tripId: string,
    dayId: string,
    dto: ReorderTripItemsDto,
  ) {
    await this.ensureActiveUser(userId);
    const day = await this.findOwnedDay(userId, tripId, dayId);
    this.assertMutable(day.trip.status);
    const result = await this.prisma.$transaction(
      async (tx) => {
        const existing = await tx.tripItem.findMany({
          where: { tripDayId: day.id },
          orderBy: { position: 'asc' },
          select: { id: true },
        });
        const known = new Set(existing.map((item) => item.id));
        const supplied = new Set(dto.itemIds);
        if (
          supplied.size !== dto.itemIds.length ||
          supplied.size !== existing.length ||
          [...supplied].some((id) => !known.has(id))
        ) {
          throw new BadRequestException(
            'Reorder requests must contain every itinerary item exactly once.',
          );
        }
        const offset = existing.length;
        await Promise.all(
          dto.itemIds.map((id, index) =>
            tx.tripItem.update({
              where: { id },
              data: { position: offset + index },
            }),
          ),
        );
        await Promise.all(
          dto.itemIds.map((id, index) =>
            tx.tripItem.update({ where: { id }, data: { position: index } }),
          ),
        );
        return tx.tripDay.findUniqueOrThrow({
          where: { id: day.id },
          select: daySelect,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return this.toDay(result);
  }

  private async findOwnedTrip(
    userId: string,
    id: string,
  ): Promise<TripDetailRecord> {
    const trip = await this.prisma.trip.findFirst({
      where: { id, userId },
      select: tripDetailSelect,
    });
    if (!trip) throw new NotFoundException('Trip not found.');
    return trip;
  }

  private async findOwnedTripForUpdate(userId: string, id: string) {
    const trip = await this.prisma.trip.findFirst({
      where: { id, userId },
      select: {
        id: true,
        userId: true,
        title: true,
        notes: true,
        status: true,
        startDate: true,
        endDate: true,
        originCityId: true,
        destinationCityId: true,
        primaryDestinationId: true,
        days: {
          select: {
            id: true,
            date: true,
            dayNumber: true,
            items: { select: { id: true } },
          },
        },
      },
    });
    if (!trip) throw new NotFoundException('Trip not found.');
    return trip;
  }

  private async findOwnedDay(userId: string, tripId: string, dayId: string) {
    const day = await this.prisma.tripDay.findFirst({
      where: { id: dayId, tripId, trip: { userId } },
      select: { id: true, trip: { select: { status: true } } },
    });
    if (!day) throw new NotFoundException('Trip day not found.');
    return day;
  }

  private async resolveLocations(
    client: TripClient,
    input: {
      originCityId: string | null;
      destinationCityId: string | null;
      primaryDestinationId: string | null;
      validatePrimaryDestination: boolean;
    },
  ) {
    if (input.originCityId) await this.ensureCity(client, input.originCityId);
    if (input.destinationCityId)
      await this.ensureCity(client, input.destinationCityId);
    if (input.primaryDestinationId && !input.destinationCityId) {
      throw new BadRequestException(
        'A primary destination requires a destination city.',
      );
    }
    if (input.primaryDestinationId && input.validatePrimaryDestination) {
      const destination = await client.destination.findFirst({
        where: { id: input.primaryDestinationId, ...publicDestinationWhere() },
        select: { id: true, cityId: true },
      });
      if (!destination || destination.cityId !== input.destinationCityId) {
        throw new BadRequestException(
          'Primary destination must be public and belong to the destination city.',
        );
      }
    }
    return {
      originCityId: input.originCityId,
      destinationCityId: input.destinationCityId,
      primaryDestinationId: input.primaryDestinationId,
    };
  }

  private async resolveItemTarget(
    client: TripClient,
    userId: string,
    tripId: string,
    dto: CreateTripItemDto,
  ): Promise<ItemTarget> {
    this.assertTargetShape(dto);
    if (dto.type === TripItemType.CUSTOM) {
      return {
        titleSnapshot: this.requiredText(dto.title, 'Custom item title'),
        destinationId: null,
        attractionId: null,
        businessId: null,
        serviceId: null,
        bookingId: null,
      };
    }
    if (dto.type === TripItemType.DESTINATION) {
      const destination = await client.destination.findFirst({
        where: { id: dto.destinationId, ...publicDestinationWhere() },
        select: { id: true, name: true },
      });
      if (!destination) throw new NotFoundException('Destination not found.');
      return this.target(destination.name, 'destinationId', destination.id);
    }
    if (dto.type === TripItemType.ATTRACTION) {
      const attraction = await client.attraction.findFirst({
        where: { id: dto.attractionId, ...publicAttractionWhere() },
        select: { id: true, name: true },
      });
      if (!attraction) throw new NotFoundException('Attraction not found.');
      return this.target(attraction.name, 'attractionId', attraction.id);
    }
    if (dto.type === TripItemType.BUSINESS) {
      const business = await client.business.findFirst({
        where: { id: dto.businessId, ...publicBusinessWhere() },
        select: { id: true, name: true },
      });
      if (!business) throw new NotFoundException('Business not found.');
      return this.target(business.name, 'businessId', business.id);
    }
    if (dto.type === TripItemType.SERVICE) {
      const service = await client.service.findFirst({
        where: { id: dto.serviceId, ...publicServiceWhere() },
        select: { id: true, name: true },
      });
      if (!service) throw new NotFoundException('Service not found.');
      return this.target(service.name, 'serviceId', service.id);
    }

    await client.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`${tripId}:${dto.bookingId ?? ''}`}))`;
    const booking = await client.booking.findFirst({
      where: { id: dto.bookingId, travelerId: userId },
      select: {
        id: true,
        reference: true,
        service: { select: { name: true } },
      },
    });
    if (!booking) throw new NotFoundException('Booking not found.');
    const duplicate = await client.tripItem.findFirst({
      where: { bookingId: booking.id, tripDay: { tripId } },
      select: { id: true },
    });
    if (duplicate)
      throw new ConflictException('This booking is already in the trip.');
    return this.target(
      `Booking ${booking.reference} · ${booking.service.name}`,
      'bookingId',
      booking.id,
    );
  }

  private target(
    titleSnapshot: string,
    field: keyof Pick<
      ItemTarget,
      | 'destinationId'
      | 'attractionId'
      | 'businessId'
      | 'serviceId'
      | 'bookingId'
    >,
    id: string,
  ): ItemTarget {
    return {
      titleSnapshot,
      destinationId: field === 'destinationId' ? id : null,
      attractionId: field === 'attractionId' ? id : null,
      businessId: field === 'businessId' ? id : null,
      serviceId: field === 'serviceId' ? id : null,
      bookingId: field === 'bookingId' ? id : null,
    };
  }

  private assertTargetShape(dto: CreateTripItemDto): void {
    const fields = [
      ['destinationId', dto.destinationId],
      ['attractionId', dto.attractionId],
      ['businessId', dto.businessId],
      ['serviceId', dto.serviceId],
      ['bookingId', dto.bookingId],
    ] as const;
    const supplied = fields.filter(([, value]) => value !== undefined);
    if (dto.type === TripItemType.CUSTOM) {
      if (supplied.length || !dto.title?.trim()) {
        throw new BadRequestException(
          'Custom items require a title and cannot reference a system entity.',
        );
      }
      return;
    }
    const expected = `${dto.type.toLowerCase()}Id`;
    if (
      supplied.length !== 1 ||
      supplied[0]?.[0] !== expected ||
      dto.title !== undefined
    ) {
      throw new BadRequestException(
        'Trip item type must match exactly one referenced entity.',
      );
    }
  }

  private async reconcileDays(
    tx: Prisma.TransactionClient,
    trip: Awaited<ReturnType<TripsService['findOwnedTripForUpdate']>>,
    start: Date,
    end: Date,
  ): Promise<void> {
    const desired = this.daysForRange(trip.id, start, end);
    const desiredDates = new Set(desired.map((day) => this.dateOnly(day.date)));
    const removed = trip.days.filter(
      (day) => !desiredDates.has(this.dateOnly(day.date)),
    );
    if (removed.some((day) => day.items.length)) {
      throw new ConflictException(
        'Adjust dates only after moving or removing items from days outside the new range.',
      );
    }
    const existingByDate = new Map(
      trip.days
        .filter(
          (day) => !removed.some((removedDay) => removedDay.id === day.id),
        )
        .map((day) => [this.dateOnly(day.date), day]),
    );
    const renumber = desired.flatMap((day) => {
      const existing = existingByDate.get(this.dateOnly(day.date));
      return existing && existing.dayNumber !== day.dayNumber
        ? [{ id: existing.id, dayNumber: day.dayNumber }]
        : [];
    });
    // Move preserved days out of the unique day-number range before assigning
    // their final positions. This keeps date-range shifts transactionally safe.
    await Promise.all(
      renumber.map((day) =>
        tx.tripDay.update({
          where: { id: day.id },
          data: { dayNumber: day.dayNumber + MAX_TRIP_DAYS + 1 },
        }),
      ),
    );
    if (removed.length) {
      await tx.tripDay.deleteMany({
        where: { id: { in: removed.map((day) => day.id) } },
      });
    }
    for (const day of desired) {
      if (!existingByDate.has(this.dateOnly(day.date))) {
        await tx.tripDay.create({ data: day });
      }
    }
    await Promise.all(
      renumber.map((day) =>
        tx.tripDay.update({
          where: { id: day.id },
          data: { dayNumber: day.dayNumber },
        }),
      ),
    );
  }

  private daysForRange(tripId: string, start: Date, end: Date) {
    const days: Array<{ tripId: string; date: Date; dayNumber: number }> = [];
    const current = new Date(start.getTime());
    while (current <= end) {
      days.push({
        tripId,
        date: new Date(current.getTime()),
        dayNumber: days.length + 1,
      });
      current.setUTCDate(current.getUTCDate() + 1);
    }
    return days;
  }

  private dateRange(startValue: string, endValue: string) {
    const start = this.dateFromString(startValue);
    const end = this.dateFromString(endValue);
    if (start > end)
      throw new BadRequestException(
        'Trip start date cannot be after end date.',
      );
    const length =
      Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
    if (length > MAX_TRIP_DAYS)
      throw new BadRequestException(
        `Trips cannot exceed ${MAX_TRIP_DAYS} days.`,
      );
    return { start, end };
  }

  private dateFromString(value: string): Date {
    if (!dateOnlyPattern.test(value))
      throw new BadRequestException('Trip dates must use YYYY-MM-DD.');
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || this.dateOnly(date) !== value) {
      throw new BadRequestException('Trip date is invalid.');
    }
    return date;
  }

  private dateOnly(value: Date): string {
    return value.toISOString().slice(0, 10);
  }

  private times(
    startTime: string | null | undefined,
    endTime: string | null | undefined,
  ) {
    const start = startTime?.trim() || null;
    const end = endTime?.trim() || null;
    if (
      (start && !timePattern.test(start)) ||
      (end && !timePattern.test(end)) ||
      (start && end && start >= end)
    ) {
      throw new BadRequestException(
        'Itinerary times must be valid and ordered.',
      );
    }
    return { startTime: start, endTime: end };
  }

  private planningStatus(status: TripStatus): TripStatus {
    if (status !== TripStatus.DRAFT && status !== TripStatus.UPCOMING) {
      throw new BadRequestException(
        'Only draft or upcoming trips may be selected.',
      );
    }
    return status;
  }

  private assertMutable(status: TripStatus): void {
    if (status === TripStatus.ARCHIVED)
      throw new ConflictException('Archived trips are read-only.');
  }

  private statusWhere(status?: TripStatus): Prisma.TripWhereInput {
    if (!status) return {};
    const today = this.dateFromString(new Date().toISOString().slice(0, 10));
    if (status === TripStatus.ARCHIVED) return { status: TripStatus.ARCHIVED };
    if (status === TripStatus.DRAFT)
      return { status: TripStatus.DRAFT, archivedAt: null };
    if (status === TripStatus.UPCOMING)
      return {
        status: TripStatus.UPCOMING,
        archivedAt: null,
        startDate: { gt: today },
      };
    if (status === TripStatus.IN_PROGRESS)
      return {
        status: TripStatus.UPCOMING,
        archivedAt: null,
        startDate: { lte: today },
        endDate: { gte: today },
      };
    return {
      status: TripStatus.UPCOMING,
      archivedAt: null,
      endDate: { lt: today },
    };
  }

  private timingWhere(timing?: TripTimingFilter): Prisma.TripWhereInput {
    if (!timing) return {};
    const today = this.dateFromString(new Date().toISOString().slice(0, 10));
    return timing === TripTimingFilter.UPCOMING
      ? { archivedAt: null, startDate: { gt: today } }
      : { archivedAt: null, endDate: { lt: today } };
  }

  private listOrder(sort: TripSort): Prisma.TripOrderByWithRelationInput {
    if (sort === TripSort.NEWEST) return { createdAt: 'desc' };
    if (sort === TripSort.RECENTLY_UPDATED) return { updatedAt: 'desc' };
    return { startDate: 'asc' };
  }

  private async ensureCity(client: TripClient, id: string): Promise<void> {
    const city = await client.city.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!city) throw new BadRequestException('Trip city not found.');
  }

  private async ensureActiveUser(userId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: UserStatus.ACTIVE },
      select: { id: true },
    });
    if (!user) throw new UnauthorizedException('Authentication required.');
  }

  private requiredText(value: string | undefined, label: string): string {
    const text = value?.trim();
    if (!text) throw new BadRequestException(`${label} is required.`);
    return text;
  }

  private optionalText(value: string | null | undefined): string | null {
    const text = value?.trim();
    return text || null;
  }

  private effectiveStatus(record: {
    status: TripStatus;
    archivedAt: Date | null;
    startDate: Date;
    endDate: Date;
  }): TripStatus {
    if (record.status === TripStatus.ARCHIVED || record.archivedAt)
      return TripStatus.ARCHIVED;
    if (record.status === TripStatus.DRAFT) return TripStatus.DRAFT;
    const today = this.dateFromString(new Date().toISOString().slice(0, 10));
    if (record.startDate > today) return TripStatus.UPCOMING;
    if (record.endDate < today) return TripStatus.COMPLETED;
    return TripStatus.IN_PROGRESS;
  }

  private toTrip(record: TripDetailRecord) {
    const days = record.days.map((day) => this.toDay(day));
    return {
      id: record.id,
      title: record.title,
      originCity: record.originCity,
      destinationCity: record.destinationCity,
      primaryDestination: record.primaryDestination,
      startDate: this.dateOnly(record.startDate),
      endDate: this.dateOnly(record.endDate),
      status: this.effectiveStatus(record),
      notes: record.notes,
      archivedAt: record.archivedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      days,
      dayCount: days.length,
      estimatedBookingCost: this.estimatedBookingCost(days),
    };
  }

  private toTripList(record: TripListRecord) {
    return {
      id: record.id,
      title: record.title,
      originCity: record.originCity,
      destinationCity: record.destinationCity,
      primaryDestination: record.primaryDestination,
      startDate: this.dateOnly(record.startDate),
      endDate: this.dateOnly(record.endDate),
      status: this.effectiveStatus(record),
      archivedAt: record.archivedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      dayCount: record._count.days,
    };
  }

  private toDay(record: TripDayRecord) {
    return {
      id: record.id,
      date: this.dateOnly(record.date),
      dayNumber: record.dayNumber,
      notes: record.notes,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      items: record.items.map((item) => this.toItem(item)),
    };
  }

  private toItem(record: TripItemRecord) {
    return {
      id: record.id,
      type: record.type,
      targetId:
        record.destinationId ??
        record.attractionId ??
        record.businessId ??
        record.serviceId ??
        record.bookingId,
      title: record.titleSnapshot,
      startTime: record.startTime,
      endTime: record.endTime,
      position: record.position,
      notes: record.notes,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      booking: record.booking,
    };
  }

  private estimatedBookingCost(days: ReturnType<TripsService['toDay']>[]) {
    const bookings = days.flatMap((day) =>
      day.items.flatMap((item) => (item.booking ? [item.booking] : [])),
    );
    if (!bookings.length) return null;
    const currencies = new Set(
      bookings
        .map((booking) => booking.currency)
        .filter((currency): currency is string => Boolean(currency)),
    );
    if (
      currencies.size !== 1 ||
      bookings.some((booking) => !booking.currency)
    ) {
      return {
        amount: null,
        currency: null,
        reason: 'MULTIPLE_OR_UNKNOWN_CURRENCIES',
      };
    }
    const total = bookings.reduce(
      (sum, booking) => sum.plus(booking.subtotal),
      new Prisma.Decimal(0),
    );
    return {
      amount: total.toString(),
      currency: [...currencies][0],
      reason: null,
    };
  }
}
