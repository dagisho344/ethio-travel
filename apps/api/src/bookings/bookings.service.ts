import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AvailabilityOverrideType,
  BookingMode,
  BookingStatus,
  BusinessMemberRole,
  BusinessStatus,
  PaymentStatus,
  PricingModel,
  Prisma,
  UserStatus,
} from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { BusinessesService } from '../businesses/businesses.service';
import { paginate, PaginatedResponse } from '../common/dto/pagination.dto';
import { publicServiceWhere } from '../common/utils/public-visibility.util';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateAvailabilityOverrideDto,
  CreateAvailabilityRuleDto,
  UpdateAvailabilityOverrideDto,
  UpdateAvailabilityRuleDto,
  UpsertAvailabilityConfigDto,
} from './dto/availability.dto';
import {
  AvailabilityQueryDto,
  BookingActionDto,
  BookingQueryDto,
  CreateBookingDto,
} from './dto/booking.dto';

const bookingSelect = Prisma.validator<Prisma.BookingSelect>()({
  id: true,
  reference: true,
  startAt: true,
  endAt: true,
  quantity: true,
  guestCount: true,
  unitPrice: true,
  subtotal: true,
  currency: true,
  pricingModelSnapshot: true,
  bookingModeSnapshot: true,
  bookingStatus: true,
  paymentStatus: true,
  travelerNote: true,
  businessNote: true,
  cancellationReason: true,
  createdAt: true,
  updatedAt: true,
  service: { select: { id: true, name: true, slug: true } },
  business: { select: { id: true, name: true, slug: true } },
  history: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      note: true,
      createdAt: true,
    },
  },
});

type BookingRecord = Prisma.BookingGetPayload<{
  select: typeof bookingSelect;
}>;
type ServiceWithBooking = Prisma.ServiceGetPayload<{
  include: {
    bookingConfig: true;
    business: {
      include: {
        category: true;
        city: { include: { region: true } };
        destination: true;
      };
    };
    category: true;
  };
}>;

type PrismaClientLike = Prisma.TransactionClient | PrismaService;

const activeCapacityStatuses = [BookingStatus.PENDING, BookingStatus.CONFIRMED];
const managerRoles = [BusinessMemberRole.OWNER, BusinessMemberRole.MANAGER];
const readerRoles = [...managerRoles, BusinessMemberRole.STAFF];
const paidModels: PricingModel[] = [
  PricingModel.FIXED,
  PricingModel.PER_PERSON,
  PricingModel.PER_NIGHT,
  PricingModel.PER_HOUR,
  PricingModel.PER_DAY,
  PricingModel.STARTING_FROM,
];

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessesService,
  ) {}

  async availability(serviceId: string, query: AvailabilityQueryDto) {
    const range = this.parseRange(query.startAt, query.endAt);
    const service = await this.findEligibleBookableService(serviceId);
    const capacity = await this.effectiveCapacity(
      serviceId,
      range.startAt,
      range.endAt,
      service.bookingConfig?.capacity ?? 0,
    );
    const used = await this.reservedQuantity(
      serviceId,
      range.startAt,
      range.endAt,
    );
    const remaining = Math.max(capacity - used, 0);
    return {
      serviceId,
      bookingMode: service.bookingConfig?.bookingMode,
      timezone: service.bookingConfig?.timezone,
      requestedQuantity: query.quantity,
      capacity,
      reserved: used,
      remaining,
      available: remaining >= query.quantity,
      startAt: range.startAt,
      endAt: range.endAt,
    };
  }

  async create(userId: string, dto: CreateBookingDto): Promise<BookingRecord> {
    await this.ensureActiveUser(userId);
    const range = this.parseRange(dto.startAt, dto.endAt);
    return this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${dto.serviceId}))`;
        const service = await this.findEligibleBookableService(
          dto.serviceId,
          tx,
        );
        this.validateBookingSelection(
          service,
          range.startAt,
          range.endAt,
          dto.quantity,
        );
        const config = service.bookingConfig;
        if (!config)
          throw new ConflictException('This service is not bookable yet.');
        const capacity = await this.effectiveCapacity(
          dto.serviceId,
          range.startAt,
          range.endAt,
          config.capacity,
          tx,
        );
        const used = await this.reservedQuantity(
          dto.serviceId,
          range.startAt,
          range.endAt,
          tx,
        );
        if (used + dto.quantity > capacity)
          throw new ConflictException('Selected time is no longer available.');

        const financial = this.financialSnapshot(service, dto.quantity);
        return tx.booking.create({
          data: {
            reference: this.reference(),
            serviceId: service.id,
            businessId: service.businessId,
            travelerId: userId,
            startAt: range.startAt,
            endAt: range.endAt,
            quantity: dto.quantity,
            guestCount: dto.guestCount,
            travelerNote: this.trim(dto.travelerNote),
            bookingStatus: BookingStatus.PENDING,
            paymentStatus: financial.paymentStatus,
            pricingModelSnapshot: service.pricingModel,
            bookingModeSnapshot: config.bookingMode,
            unitPrice: financial.unitPrice,
            subtotal: financial.subtotal,
            currency: financial.currency,
            history: {
              create: {
                toStatus: BookingStatus.PENDING,
                changedById: userId,
                note: 'Booking requested.',
              },
            },
          },
          select: bookingSelect,
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  async findMine(
    userId: string,
    query: BookingQueryDto,
  ): Promise<PaginatedResponse<BookingRecord>> {
    await this.ensureActiveUser(userId);
    const where: Prisma.BookingWhereInput = {
      travelerId: userId,
      bookingStatus: this.status(query.status),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        select: bookingSelect,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.booking.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  async findMineById(userId: string, id: string): Promise<BookingRecord> {
    await this.ensureActiveUser(userId);
    const booking = await this.prisma.booking.findFirst({
      where: { id, travelerId: userId },
      select: bookingSelect,
    });
    if (!booking) throw new NotFoundException('Booking not found.');
    return booking;
  }

  async cancelMine(
    userId: string,
    id: string,
    dto: BookingActionDto,
  ): Promise<BookingRecord> {
    await this.ensureActiveUser(userId);
    return this.transition(
      id,
      userId,
      BookingStatus.CANCELLED_BY_TRAVELER,
      [BookingStatus.PENDING, BookingStatus.CONFIRMED],
      dto.reason ?? dto.note,
      { travelerId: userId },
    );
  }

  async findBusinessBookings(
    userId: string,
    businessId: string,
    query: BookingQueryDto,
  ): Promise<PaginatedResponse<BookingRecord>> {
    await this.businesses.requireMembership(userId, businessId, readerRoles);
    const where: Prisma.BookingWhereInput = {
      businessId,
      bookingStatus: this.status(query.status),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        select: bookingSelect,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.booking.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  async findBusinessBooking(
    userId: string,
    businessId: string,
    id: string,
  ): Promise<BookingRecord> {
    await this.businesses.requireMembership(userId, businessId, readerRoles);
    const booking = await this.prisma.booking.findFirst({
      where: { id, businessId },
      select: bookingSelect,
    });
    if (!booking) throw new NotFoundException('Booking not found.');
    return booking;
  }

  async confirmBusiness(
    userId: string,
    businessId: string,
    id: string,
    dto: BookingActionDto,
  ): Promise<BookingRecord> {
    await this.businesses.requireMembership(userId, businessId, managerRoles);
    return this.transition(
      id,
      userId,
      BookingStatus.CONFIRMED,
      [BookingStatus.PENDING],
      dto.note,
      { businessId },
    );
  }

  async rejectBusiness(
    userId: string,
    businessId: string,
    id: string,
    dto: BookingActionDto,
  ): Promise<BookingRecord> {
    await this.businesses.requireMembership(userId, businessId, managerRoles);
    return this.transition(
      id,
      userId,
      BookingStatus.REJECTED,
      [BookingStatus.PENDING],
      dto.reason ?? dto.note,
      { businessId },
    );
  }

  async cancelBusiness(
    userId: string,
    businessId: string,
    id: string,
    dto: BookingActionDto,
  ): Promise<BookingRecord> {
    await this.businesses.requireMembership(userId, businessId, managerRoles);
    return this.transition(
      id,
      userId,
      BookingStatus.CANCELLED_BY_BUSINESS,
      [BookingStatus.PENDING, BookingStatus.CONFIRMED],
      dto.reason ?? dto.note,
      { businessId },
    );
  }

  async completeBusiness(
    userId: string,
    businessId: string,
    id: string,
    dto: BookingActionDto,
  ): Promise<BookingRecord> {
    await this.businesses.requireMembership(userId, businessId, managerRoles);
    return this.transition(
      id,
      userId,
      BookingStatus.COMPLETED,
      [BookingStatus.CONFIRMED],
      dto.note,
      { businessId },
    );
  }

  async noShowBusiness(
    userId: string,
    businessId: string,
    id: string,
    dto: BookingActionDto,
  ): Promise<BookingRecord> {
    await this.businesses.requireMembership(userId, businessId, managerRoles);
    return this.transition(
      id,
      userId,
      BookingStatus.NO_SHOW,
      [BookingStatus.CONFIRMED],
      dto.reason ?? dto.note,
      { businessId },
    );
  }

  async findAdmin(
    query: BookingQueryDto,
  ): Promise<PaginatedResponse<BookingRecord>> {
    const where: Prisma.BookingWhereInput = {
      bookingStatus: this.status(query.status),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.booking.findMany({
        where,
        select: bookingSelect,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.booking.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  async getConfig(userId: string, serviceId: string) {
    const service = await this.findServiceForMember(
      userId,
      serviceId,
      readerRoles,
    );
    return service.bookingConfig;
  }

  async upsertConfig(
    userId: string,
    serviceId: string,
    dto: UpsertAvailabilityConfigDto,
  ) {
    await this.findServiceForMember(userId, serviceId, managerRoles);
    this.validateConfig(dto);
    return this.prisma.serviceBookingConfig.upsert({
      where: { serviceId },
      create: {
        serviceId,
        enabled: dto.enabled ?? false,
        bookingMode: dto.bookingMode ?? BookingMode.TIME_SLOT,
        timezone: dto.timezone ?? 'Africa/Addis_Ababa',
        capacity: dto.capacity ?? 1,
        minQuantity: dto.minQuantity ?? 1,
        maxQuantity: dto.maxQuantity ?? dto.minQuantity ?? 1,
        minDurationMinutes: dto.minDurationMinutes,
        maxDurationMinutes: dto.maxDurationMinutes,
        advanceNoticeMinutes: dto.advanceNoticeMinutes ?? 0,
      },
      update: dto,
    });
  }

  async rules(userId: string, serviceId: string) {
    await this.findServiceForMember(userId, serviceId, readerRoles);
    return this.prisma.serviceAvailabilityRule.findMany({
      where: { serviceId },
      orderBy: [{ weekday: 'asc' }, { startTime: 'asc' }],
    });
  }

  async createRule(
    userId: string,
    serviceId: string,
    dto: CreateAvailabilityRuleDto,
  ) {
    await this.findServiceForMember(userId, serviceId, managerRoles);
    this.validateRule(dto);
    return this.prisma.serviceAvailabilityRule.create({
      data: {
        ...dto,
        serviceId,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
      },
    });
  }

  async updateRule(
    userId: string,
    serviceId: string,
    id: string,
    dto: UpdateAvailabilityRuleDto,
  ) {
    await this.findServiceForMember(userId, serviceId, managerRoles);
    this.validateRule(dto);
    const result = await this.prisma.serviceAvailabilityRule.updateMany({
      where: { id, serviceId },
      data: {
        ...dto,
        validFrom: dto.validFrom ? new Date(dto.validFrom) : undefined,
        validUntil: dto.validUntil ? new Date(dto.validUntil) : undefined,
      },
    });
    if (result.count === 0)
      throw new NotFoundException('Availability rule not found.');
    return this.prisma.serviceAvailabilityRule.findUniqueOrThrow({
      where: { id },
    });
  }

  async deleteRule(
    userId: string,
    serviceId: string,
    id: string,
  ): Promise<void> {
    await this.findServiceForMember(userId, serviceId, managerRoles);
    const result = await this.prisma.serviceAvailabilityRule.deleteMany({
      where: { id, serviceId },
    });
    if (result.count === 0)
      throw new NotFoundException('Availability rule not found.');
  }

  async overrides(userId: string, serviceId: string) {
    await this.findServiceForMember(userId, serviceId, readerRoles);
    return this.prisma.serviceAvailabilityOverride.findMany({
      where: { serviceId },
      orderBy: { startAt: 'asc' },
    });
  }

  async createOverride(
    userId: string,
    serviceId: string,
    dto: CreateAvailabilityOverrideDto,
  ) {
    await this.findServiceForMember(userId, serviceId, managerRoles);
    const range = this.parseRange(dto.startAt, dto.endAt);
    const type = dto.type ?? AvailabilityOverrideType.BLOCKED;
    this.validateOverrideType(type, dto.capacity);
    return this.prisma.serviceAvailabilityOverride.create({
      data: {
        serviceId,
        startAt: range.startAt,
        endAt: range.endAt,
        type,
        capacity: dto.capacity,
        reason: this.trim(dto.reason),
      },
    });
  }

  async updateOverride(
    userId: string,
    serviceId: string,
    id: string,
    dto: UpdateAvailabilityOverrideDto,
  ) {
    await this.findServiceForMember(userId, serviceId, managerRoles);
    const data = this.overrideData(dto, true);
    const result = await this.prisma.serviceAvailabilityOverride.updateMany({
      where: { id, serviceId },
      data,
    });
    if (result.count === 0)
      throw new NotFoundException('Availability override not found.');
    return this.prisma.serviceAvailabilityOverride.findUniqueOrThrow({
      where: { id },
    });
  }

  async deleteOverride(
    userId: string,
    serviceId: string,
    id: string,
  ): Promise<void> {
    await this.findServiceForMember(userId, serviceId, managerRoles);
    const result = await this.prisma.serviceAvailabilityOverride.deleteMany({
      where: { id, serviceId },
    });
    if (result.count === 0)
      throw new NotFoundException('Availability override not found.');
  }

  private async transition(
    id: string,
    userId: string,
    toStatus: BookingStatus,
    fromStatuses: BookingStatus[],
    note?: string,
    scope: Prisma.BookingWhereInput = {},
  ): Promise<BookingRecord> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.booking.findFirst({
        where: { id, ...scope },
        select: { id: true, bookingStatus: true },
      });
      if (!existing) throw new NotFoundException('Booking not found.');

      const result = await tx.booking.updateMany({
        where: { id, ...scope, bookingStatus: { in: fromStatuses } },
        data: {
          bookingStatus: toStatus,
          cancellationReason: toStatus.toString().startsWith('CANCELLED')
            ? this.trim(note)
            : undefined,
          businessNote:
            toStatus === BookingStatus.CONFIRMED ||
            toStatus === BookingStatus.REJECTED
              ? this.trim(note)
              : undefined,
        },
      });
      if (result.count === 0)
        throw new ConflictException(
          'Booking cannot transition from its current state.',
        );

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: id,
          fromStatus: existing.bookingStatus,
          toStatus,
          changedById: userId,
          note: this.trim(note),
        },
      });
      return tx.booking.findUniqueOrThrow({
        where: { id },
        select: bookingSelect,
      });
    });
  }

  private async findEligibleBookableService(
    serviceId: string,
    tx: PrismaClientLike = this.prisma,
  ): Promise<ServiceWithBooking> {
    const service = await tx.service.findFirst({
      where: { id: serviceId, ...publicServiceWhere() },
      include: {
        bookingConfig: true,
        category: true,
        business: {
          include: {
            category: true,
            city: { include: { region: true } },
            destination: true,
          },
        },
      },
    });
    if (!service) throw new NotFoundException('Bookable service not found.');
    if (!service.bookingConfig?.enabled)
      throw new ConflictException('This service is not bookable yet.');
    if (service.business.status === BusinessStatus.SUSPENDED)
      throw new ConflictException(
        'Suspended businesses cannot receive bookings.',
      );
    return service;
  }

  private async findServiceForMember(
    userId: string,
    serviceId: string,
    roles: BusinessMemberRole[],
  ): Promise<ServiceWithBooking> {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      include: {
        bookingConfig: true,
        category: true,
        business: {
          include: {
            category: true,
            city: { include: { region: true } },
            destination: true,
          },
        },
      },
    });
    if (!service) throw new NotFoundException('Service not found.');
    await this.businesses.requireMembership(userId, service.businessId, roles);
    return service;
  }

  private async ensureActiveUser(userId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: UserStatus.ACTIVE },
      select: { id: true },
    });
    if (!user) throw new UnauthorizedException('Authentication required.');
  }

  private parseRange(start: string, end: string) {
    const startAt = new Date(start);
    const endAt = new Date(end);
    if (Number.isNaN(startAt.getTime()) || Number.isNaN(endAt.getTime()))
      throw new BadRequestException('Invalid booking date range.');
    if (startAt >= endAt)
      throw new BadRequestException('Booking start must be before end.');
    if (startAt < new Date())
      throw new BadRequestException('Bookings cannot start in the past.');
    return { startAt, endAt };
  }

  private validateBookingSelection(
    service: ServiceWithBooking,
    startAt: Date,
    endAt: Date,
    quantity: number,
  ): void {
    const config = service.bookingConfig;
    if (!config)
      throw new ConflictException('This service is not bookable yet.');
    if (quantity < config.minQuantity || quantity > config.maxQuantity)
      throw new BadRequestException('Quantity is outside the allowed range.');
    if (new Date(Date.now() + config.advanceNoticeMinutes * 60000) > startAt)
      throw new BadRequestException('Booking does not satisfy advance notice.');

    const minutes = Math.ceil((endAt.getTime() - startAt.getTime()) / 60000);
    if (config.bookingMode === BookingMode.DATE && minutes > 24 * 60)
      throw new BadRequestException('Date bookings cannot exceed one day.');
    if (config.minDurationMinutes && minutes < config.minDurationMinutes)
      throw new BadRequestException('Booking duration is too short.');
    if (config.maxDurationMinutes && minutes > config.maxDurationMinutes)
      throw new BadRequestException('Booking duration is too long.');
  }

  private async effectiveCapacity(
    serviceId: string,
    startAt: Date,
    endAt: Date,
    fallback: number,
    tx: PrismaClientLike = this.prisma,
  ): Promise<number> {
    const blocked = await tx.serviceAvailabilityOverride.findFirst({
      where: {
        serviceId,
        type: AvailabilityOverrideType.BLOCKED,
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
      select: { id: true },
    });
    if (blocked) return 0;

    const capacityOverride = await tx.serviceAvailabilityOverride.findFirst({
      where: {
        serviceId,
        type: AvailabilityOverrideType.CAPACITY,
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
      orderBy: { createdAt: 'desc' },
      select: { capacity: true },
    });
    if (capacityOverride?.capacity !== null && capacityOverride !== null)
      return capacityOverride.capacity;

    const ruleCapacity = await this.ruleCapacity(serviceId, startAt, endAt, tx);
    return ruleCapacity ?? fallback;
  }

  private async ruleCapacity(
    serviceId: string,
    startAt: Date,
    endAt: Date,
    tx: PrismaClientLike,
  ): Promise<number | null> {
    const startTime = this.utcTime(startAt);
    const endTime = this.utcTime(endAt);
    const rule = await tx.serviceAvailabilityRule.findFirst({
      where: {
        serviceId,
        isActive: true,
        weekday: startAt.getUTCDay(),
        startTime: { lte: startTime },
        endTime: { gte: endTime },
        AND: [
          { OR: [{ validFrom: null }, { validFrom: { lte: startAt } }] },
          { OR: [{ validUntil: null }, { validUntil: { gte: startAt } }] },
        ],
      },
      orderBy: { capacity: 'desc' },
      select: { capacity: true },
    });
    return rule?.capacity ?? null;
  }

  private async reservedQuantity(
    serviceId: string,
    startAt: Date,
    endAt: Date,
    tx: PrismaClientLike = this.prisma,
  ): Promise<number> {
    const aggregate = await tx.booking.aggregate({
      where: {
        serviceId,
        bookingStatus: { in: activeCapacityStatuses },
        startAt: { lt: endAt },
        endAt: { gt: startAt },
      },
      _sum: { quantity: true },
    });
    return aggregate._sum.quantity ?? 0;
  }

  private financialSnapshot(service: ServiceWithBooking, quantity: number) {
    if (!paidModels.includes(service.pricingModel))
      return {
        unitPrice: null,
        subtotal: new Prisma.Decimal(0),
        currency: null,
        paymentStatus: PaymentStatus.NOT_REQUIRED,
      };
    if (!service.price || !service.currency)
      throw new ConflictException('Service pricing is incomplete.');
    const unitPrice = service.price;
    return {
      unitPrice,
      subtotal: unitPrice.mul(quantity),
      currency: service.currency,
      paymentStatus: PaymentStatus.UNPAID,
    };
  }

  private validateConfig(dto: UpsertAvailabilityConfigDto): void {
    const min = dto.minQuantity ?? 1;
    const max = dto.maxQuantity ?? min;
    if (max < min)
      throw new BadRequestException(
        'Maximum quantity must be at least minimum quantity.',
      );
    if (
      dto.minDurationMinutes &&
      dto.maxDurationMinutes &&
      dto.maxDurationMinutes < dto.minDurationMinutes
    )
      throw new BadRequestException(
        'Maximum duration must be at least minimum duration.',
      );
  }

  private validateRule(dto: Partial<CreateAvailabilityRuleDto>): void {
    if (dto.startTime && dto.endTime && dto.startTime >= dto.endTime)
      throw new BadRequestException(
        'Availability start time must be before end time.',
      );
    if (
      dto.validFrom &&
      dto.validUntil &&
      new Date(dto.validFrom) > new Date(dto.validUntil)
    )
      throw new BadRequestException(
        'Availability valid-from must be before valid-until.',
      );
  }

  private overrideData(
    dto: CreateAvailabilityOverrideDto | UpdateAvailabilityOverrideDto,
    partial = false,
  ) {
    if (dto.startAt !== undefined && dto.endAt !== undefined) {
      this.parseRange(dto.startAt, dto.endAt);
    } else if (
      !partial ||
      dto.startAt !== undefined ||
      dto.endAt !== undefined
    ) {
      throw new BadRequestException(
        'Override start and end must be provided together.',
      );
    }

    const type = dto.type ?? AvailabilityOverrideType.BLOCKED;
    if (
      type === AvailabilityOverrideType.CAPACITY &&
      dto.capacity === undefined
    )
      throw new BadRequestException('Capacity override requires capacity.');
    if (type === AvailabilityOverrideType.BLOCKED && dto.capacity !== undefined)
      throw new BadRequestException(
        'Blocked override cannot include capacity.',
      );

    return {
      startAt: dto.startAt ? new Date(dto.startAt) : undefined,
      endAt: dto.endAt ? new Date(dto.endAt) : undefined,
      type: dto.type,
      capacity: dto.capacity,
      reason: this.trim(dto.reason),
    };
  }

  private validateOverrideType(
    type: AvailabilityOverrideType,
    capacity?: number,
  ): void {
    if (type === AvailabilityOverrideType.CAPACITY && capacity === undefined)
      throw new BadRequestException('Capacity override requires capacity.');
    if (type === AvailabilityOverrideType.BLOCKED && capacity !== undefined)
      throw new BadRequestException(
        'Blocked override cannot include capacity.',
      );
  }
  private status(value?: string): BookingStatus | undefined {
    if (!value) return undefined;
    if (Object.values(BookingStatus).includes(value as BookingStatus))
      return value as BookingStatus;
    throw new BadRequestException('Invalid booking status.');
  }

  private reference(): string {
    return `ETB-${randomBytes(5).toString('hex').toUpperCase()}`;
  }

  private utcTime(value: Date): string {
    return `${value.getUTCHours().toString().padStart(2, '0')}:${value
      .getUTCMinutes()
      .toString()
      .padStart(2, '0')}`;
  }

  private trim(value?: string): string | undefined {
    const trimmed = value?.trim();
    return trimmed || undefined;
  }
}
