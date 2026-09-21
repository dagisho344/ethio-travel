import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  BusinessMemberRole,
  LocationStatus,
  Prisma,
  ServiceStatus,
  UserStatus,
} from '@prisma/client';
import { BusinessesService } from '../businesses/businesses.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  MAX_TRANSPORT_ROUTES,
  MAX_TRANSPORT_SCHEDULES_PER_ROUTE,
  TRANSPORT_SERVICE_CATEGORY_FAMILY,
} from './transport.constants';
import {
  CreateTransportRouteDto,
  CreateTransportScheduleDto,
  UpdateTransportDetailDto,
  UpdateTransportRouteDto,
  UpdateTransportScheduleDto,
} from './dto/transport.dto';

const writableRoles = [BusinessMemberRole.OWNER, BusinessMemberRole.MANAGER];
const readableRoles = [...writableRoles, BusinessMemberRole.STAFF];

const transportServiceSelect = Prisma.validator<Prisma.ServiceSelect>()({
  id: true,
  name: true,
  status: true,
  category: { select: { code: true, family: true, name: true } },
  transportDetail: {
    select: {
      id: true,
      mode: true,
      operatorName: true,
      routes: {
        orderBy: { createdAt: 'asc' },
        take: MAX_TRANSPORT_ROUTES,
        select: {
          id: true,
          originCity: { select: { id: true, name: true, slug: true } },
          destinationCity: { select: { id: true, name: true, slug: true } },
          createdAt: true,
          updatedAt: true,
          schedules: {
            orderBy: [{ departureAt: 'asc' }, { createdAt: 'asc' }],
            take: MAX_TRANSPORT_SCHEDULES_PER_ROUTE,
            select: {
              id: true,
              departureAt: true,
              arrivalAt: true,
              fare: true,
              currency: true,
              capacity: true,
              isActive: true,
              createdAt: true,
              updatedAt: true,
            },
          },
        },
      },
    },
  },
});

type TransportServiceRecord = Prisma.ServiceGetPayload<{
  select: typeof transportServiceSelect;
}>;
type TransportDetailRecord = NonNullable<
  TransportServiceRecord['transportDetail']
>;
type TransportRouteRecord = TransportDetailRecord['routes'][number];
type TransportScheduleRecord = TransportRouteRecord['schedules'][number];
type TransportDetailValues = { mode?: string; operatorName?: string };

@Injectable()
export class TransportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessesService,
  ) {}

  async findMine(userId: string, businessId: string, serviceId: string) {
    await this.ensureActiveUser(userId);
    await this.businesses.requireMembership(userId, businessId, readableRoles);
    return this.toResponse(
      await this.findTransportService(businessId, serviceId),
    );
  }

  async updateDetail(
    userId: string,
    businessId: string,
    serviceId: string,
    dto: UpdateTransportDetailDto,
  ) {
    await this.ensureActiveUser(userId);
    await this.businesses.requireMembership(userId, businessId, writableRoles);
    const service = await this.findTransportService(businessId, serviceId);
    this.ensureServiceCanChange(service);
    await this.prisma.transportDetail.upsert({
      where: { serviceId: service.id },
      create: {
        service: { connect: { id: service.id } },
        ...this.detailData(dto),
      },
      update: this.detailData(dto),
    });
    return this.toResponse(
      await this.findTransportService(businessId, serviceId),
    );
  }

  async listRoutes(userId: string, businessId: string, serviceId: string) {
    const response = await this.findMine(userId, businessId, serviceId);
    return response.routes;
  }

  async createRoute(
    userId: string,
    businessId: string,
    serviceId: string,
    dto: CreateTransportRouteDto,
  ) {
    await this.ensureActiveUser(userId);
    await this.businesses.requireMembership(userId, businessId, writableRoles);
    const service = await this.findTransportService(businessId, serviceId);
    this.ensureServiceCanChange(service);
    const detail = this.requireDetail(service);
    await this.ensureDistinctActiveCities(
      dto.originCityId,
      dto.destinationCityId,
    );
    const routeCount = await this.prisma.transportRoute.count({
      where: { transportDetailId: detail.id },
    });
    if (routeCount >= MAX_TRANSPORT_ROUTES) {
      throw new ConflictException('Transport route limit has been reached.');
    }
    return this.toRoute(
      await this.prisma.transportRoute.create({
        data: {
          transportDetail: { connect: { id: detail.id } },
          originCity: { connect: { id: dto.originCityId } },
          destinationCity: { connect: { id: dto.destinationCityId } },
        },
        select: this.routeSelect(),
      }),
    );
  }

  async updateRoute(
    userId: string,
    businessId: string,
    serviceId: string,
    routeId: string,
    dto: UpdateTransportRouteDto,
  ) {
    await this.ensureActiveUser(userId);
    await this.businesses.requireMembership(userId, businessId, writableRoles);
    const service = await this.findTransportService(businessId, serviceId);
    this.ensureServiceCanChange(service);
    const route = await this.findRouteForService(routeId, service.id);
    const originCityId = dto.originCityId ?? route.originCityId;
    const destinationCityId = dto.destinationCityId ?? route.destinationCityId;
    await this.ensureDistinctActiveCities(originCityId, destinationCityId);
    return this.toRoute(
      await this.prisma.transportRoute.update({
        where: { id: route.id },
        data: {
          originCity: dto.originCityId
            ? { connect: { id: dto.originCityId } }
            : undefined,
          destinationCity: dto.destinationCityId
            ? { connect: { id: dto.destinationCityId } }
            : undefined,
        },
        select: this.routeSelect(),
      }),
    );
  }

  async listSchedules(
    userId: string,
    businessId: string,
    serviceId: string,
    routeId: string,
  ) {
    await this.ensureActiveUser(userId);
    await this.businesses.requireMembership(userId, businessId, readableRoles);
    const service = await this.findTransportService(businessId, serviceId);
    const route = await this.findRouteForService(routeId, service.id);
    const result = await this.prisma.transportRoute.findUnique({
      where: { id: route.id },
      select: {
        schedules: {
          orderBy: [{ departureAt: 'asc' }, { createdAt: 'asc' }],
          take: MAX_TRANSPORT_SCHEDULES_PER_ROUTE,
          select: this.scheduleSelect(),
        },
      },
    });
    return result?.schedules.map((schedule) => this.toSchedule(schedule)) ?? [];
  }

  async createSchedule(
    userId: string,
    businessId: string,
    serviceId: string,
    routeId: string,
    dto: CreateTransportScheduleDto,
  ) {
    await this.ensureActiveUser(userId);
    await this.businesses.requireMembership(userId, businessId, writableRoles);
    const service = await this.findTransportService(businessId, serviceId);
    this.ensureServiceCanChange(service);
    const route = await this.findRouteForService(routeId, service.id);
    const scheduleCount = await this.prisma.transportSchedule.count({
      where: { routeId: route.id },
    });
    if (scheduleCount >= MAX_TRANSPORT_SCHEDULES_PER_ROUTE) {
      throw new ConflictException('Transport schedule limit has been reached.');
    }
    const departureAt = this.toTimestamp(dto.departureAt);
    const arrivalAt = this.toTimestamp(dto.arrivalAt);
    this.ensureChronological(departureAt, arrivalAt);
    return this.toSchedule(
      await this.prisma.transportSchedule.create({
        data: {
          route: { connect: { id: route.id } },
          departureAt,
          arrivalAt,
          fare: new Prisma.Decimal(dto.fare),
          currency: dto.currency,
          capacity: dto.capacity,
        },
        select: this.scheduleSelect(),
      }),
    );
  }

  async updateSchedule(
    userId: string,
    businessId: string,
    serviceId: string,
    routeId: string,
    scheduleId: string,
    dto: UpdateTransportScheduleDto,
  ) {
    await this.ensureActiveUser(userId);
    await this.businesses.requireMembership(userId, businessId, writableRoles);
    const service = await this.findTransportService(businessId, serviceId);
    this.ensureServiceCanChange(service);
    const route = await this.findRouteForService(routeId, service.id);
    const schedule = await this.findScheduleForRoute(
      scheduleId,
      route.id,
      service.id,
    );
    const departureAt = dto.departureAt
      ? this.toTimestamp(dto.departureAt)
      : schedule.departureAt;
    const arrivalAt = dto.arrivalAt
      ? this.toTimestamp(dto.arrivalAt)
      : schedule.arrivalAt;
    this.ensureChronological(departureAt, arrivalAt);
    return this.toSchedule(
      await this.prisma.transportSchedule.update({
        where: { id: schedule.id },
        data: this.scheduleData(dto, departureAt, arrivalAt),
        select: this.scheduleSelect(),
      }),
    );
  }

  async setScheduleActive(
    userId: string,
    businessId: string,
    serviceId: string,
    routeId: string,
    scheduleId: string,
    isActive: boolean,
  ) {
    await this.ensureActiveUser(userId);
    await this.businesses.requireMembership(userId, businessId, writableRoles);
    const service = await this.findTransportService(businessId, serviceId);
    this.ensureServiceCanChange(service);
    const route = await this.findRouteForService(routeId, service.id);
    const schedule = await this.findScheduleForRoute(
      scheduleId,
      route.id,
      service.id,
    );
    return this.toSchedule(
      await this.prisma.transportSchedule.update({
        where: { id: schedule.id },
        data: { isActive },
        select: this.scheduleSelect(),
      }),
    );
  }

  private async findTransportService(
    businessId: string,
    serviceId: string,
  ): Promise<TransportServiceRecord> {
    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, businessId },
      select: transportServiceSelect,
    });
    if (!service) throw new NotFoundException('Service not found.');
    if (service.category.family !== TRANSPORT_SERVICE_CATEGORY_FAMILY) {
      throw new ConflictException(
        'Transport configuration is only available for TRANSPORT services.',
      );
    }
    return service;
  }

  private requireDetail(
    service: TransportServiceRecord,
  ): TransportDetailRecord {
    if (!service.transportDetail) {
      throw new ConflictException(
        'Configure transport details before adding routes.',
      );
    }
    return service.transportDetail;
  }

  private async findRouteForService(routeId: string, serviceId: string) {
    const route = await this.prisma.transportRoute.findFirst({
      where: { id: routeId, transportDetail: { serviceId } },
      select: { id: true, originCityId: true, destinationCityId: true },
    });
    if (!route) throw new NotFoundException('Transport route not found.');
    return route;
  }

  private async findScheduleForRoute(
    scheduleId: string,
    routeId: string,
    serviceId: string,
  ) {
    const schedule = await this.prisma.transportSchedule.findFirst({
      where: {
        id: scheduleId,
        routeId,
        route: { transportDetail: { serviceId } },
      },
      select: { id: true, departureAt: true, arrivalAt: true },
    });
    if (!schedule) throw new NotFoundException('Transport schedule not found.');
    return schedule;
  }

  private async ensureDistinctActiveCities(
    originCityId: string,
    destinationCityId: string,
  ): Promise<void> {
    if (originCityId === destinationCityId) {
      throw new BadRequestException(
        'Origin and destination cities must be different.',
      );
    }
    const cityCount = await this.prisma.city.count({
      where: {
        id: { in: [originCityId, destinationCityId] },
        status: LocationStatus.ACTIVE,
      },
    });
    if (cityCount !== 2) {
      throw new NotFoundException(
        'Origin and destination must be active cities.',
      );
    }
  }

  private ensureServiceCanChange(service: TransportServiceRecord): void {
    if (service.status === ServiceStatus.ARCHIVED) {
      throw new ConflictException('Archived services cannot be changed.');
    }
  }

  private async ensureActiveUser(userId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: UserStatus.ACTIVE },
      select: { id: true },
    });
    if (!user) throw new ForbiddenException('Active user is required.');
  }

  private detailData(dto: UpdateTransportDetailDto): TransportDetailValues {
    const data: TransportDetailValues = {};
    if (dto.mode !== undefined) data.mode = dto.mode.trim();
    if (dto.operatorName !== undefined)
      data.operatorName = dto.operatorName.trim();
    return data;
  }

  private scheduleData(
    dto: UpdateTransportScheduleDto,
    departureAt: Date,
    arrivalAt: Date,
  ): Prisma.TransportScheduleUpdateInput {
    const data: Prisma.TransportScheduleUpdateInput = {};
    if (dto.departureAt !== undefined) data.departureAt = departureAt;
    if (dto.arrivalAt !== undefined) data.arrivalAt = arrivalAt;
    if (dto.fare !== undefined) data.fare = new Prisma.Decimal(dto.fare);
    if (dto.currency !== undefined) data.currency = dto.currency;
    if (dto.capacity !== undefined) data.capacity = dto.capacity;
    return data;
  }

  private toTimestamp(value: string): Date {
    const timestamp = new Date(value);
    if (Number.isNaN(timestamp.getTime())) {
      throw new BadRequestException('A valid ISO timestamp is required.');
    }
    return timestamp;
  }

  private ensureChronological(departureAt: Date, arrivalAt: Date): void {
    if (arrivalAt.getTime() <= departureAt.getTime()) {
      throw new BadRequestException('Arrival must be after departure.');
    }
  }

  private routeSelect() {
    return {
      id: true,
      originCity: { select: { id: true, name: true, slug: true } },
      destinationCity: { select: { id: true, name: true, slug: true } },
      createdAt: true,
      updatedAt: true,
      schedules: {
        orderBy: [{ departureAt: 'asc' }, { createdAt: 'asc' }],
        take: MAX_TRANSPORT_SCHEDULES_PER_ROUTE,
        select: this.scheduleSelect(),
      },
    } satisfies Prisma.TransportRouteSelect;
  }

  private scheduleSelect() {
    return {
      id: true,
      departureAt: true,
      arrivalAt: true,
      fare: true,
      currency: true,
      capacity: true,
      isActive: true,
      createdAt: true,
      updatedAt: true,
    } satisfies Prisma.TransportScheduleSelect;
  }

  private toResponse(service: TransportServiceRecord) {
    return {
      service: {
        id: service.id,
        name: service.name,
        status: service.status,
        category: service.category,
      },
      detail: service.transportDetail
        ? {
            id: service.transportDetail.id,
            mode: service.transportDetail.mode,
            operatorName: service.transportDetail.operatorName,
          }
        : null,
      routes: service.transportDetail
        ? service.transportDetail.routes.map((route) => this.toRoute(route))
        : [],
    };
  }

  private toRoute(route: TransportRouteRecord) {
    return {
      id: route.id,
      originCity: route.originCity,
      destinationCity: route.destinationCity,
      createdAt: route.createdAt,
      updatedAt: route.updatedAt,
      schedules: route.schedules.map((schedule) => this.toSchedule(schedule)),
    };
  }

  private toSchedule(schedule: TransportScheduleRecord) {
    return {
      id: schedule.id,
      departureAt: schedule.departureAt.toISOString(),
      arrivalAt: schedule.arrivalAt.toISOString(),
      fare: schedule.fare.toString(),
      currency: schedule.currency,
      capacity: schedule.capacity,
      isActive: schedule.isActive,
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt,
    };
  }
}
