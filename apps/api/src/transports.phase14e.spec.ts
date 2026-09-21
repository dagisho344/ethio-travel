import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import {
  BusinessMemberRole,
  BusinessMemberStatus,
  ServiceCategoryFamily,
  ServiceStatus,
} from '@prisma/client';
import { BusinessesService } from './businesses/businesses.service';
import { PrismaService } from './prisma/prisma.service';
import {
  MAX_TRANSPORT_ROUTES,
  MAX_TRANSPORT_SCHEDULES_PER_ROUTE,
} from './transports/transport.constants';
import { TransportsService } from './transports/transports.service';

const userId = '11111111-1111-4111-8111-111111111111';
const businessId = '22222222-2222-4222-8222-222222222222';
const serviceId = '33333333-3333-4333-8333-333333333333';
const detailId = '44444444-4444-4444-8444-444444444444';
const routeId = '55555555-5555-4555-8555-555555555555';
const scheduleId = '66666666-6666-4666-8666-666666666666';
const originCityId = '77777777-7777-4777-8777-777777777777';
const destinationCityId = '88888888-8888-4888-8888-888888888888';
const createdAt = new Date('2026-09-20T10:00:00.000Z');

function scheduleRecord() {
  return {
    id: scheduleId,
    departureAt: new Date('2026-10-01T08:00:00.000Z'),
    arrivalAt: new Date('2026-10-01T12:00:00.000Z'),
    fare: { toString: () => '250.00' },
    currency: 'ETB',
    capacity: 24,
    isActive: true,
    createdAt,
    updatedAt: createdAt,
  };
}

function routeRecord() {
  return {
    id: routeId,
    originCityId,
    destinationCityId,
    originCity: { id: originCityId, name: 'Addis Ababa', slug: 'addis-ababa' },
    destinationCity: {
      id: destinationCityId,
      name: 'Wolaita Sodo',
      slug: 'wolaita-sodo',
    },
    createdAt,
    updatedAt: createdAt,
    schedules: [scheduleRecord()],
  };
}

function serviceRecord(options?: {
  family?: ServiceCategoryFamily;
  code?: string;
  detail?: boolean;
  status?: ServiceStatus;
}) {
  return {
    id: serviceId,
    name: 'Addis to Sodo Shuttle',
    status: options?.status ?? ServiceStatus.DRAFT,
    category: {
      code: options?.code ?? 'TRANSFER',
      family: options?.family ?? ServiceCategoryFamily.TRANSPORT,
      name: 'Not used for compatibility',
    },
    transportDetail:
      options?.detail === false
        ? null
        : {
            id: detailId,
            mode: 'SHUTTLE',
            operatorName: 'Ethio Shuttle',
            routes: [routeRecord()],
          },
  };
}

function fixture(record = serviceRecord()) {
  const requireMembership = jest
    .fn()
    .mockResolvedValue({ role: BusinessMemberRole.OWNER });
  const userFindFirst = jest.fn().mockResolvedValue({ id: userId });
  const serviceFindFirst = jest.fn().mockResolvedValue(record);
  const detailUpsert = jest.fn().mockResolvedValue({});
  const cityCount = jest.fn().mockResolvedValue(2);
  const routeCount = jest.fn().mockResolvedValue(0);
  const routeCreate = jest.fn().mockResolvedValue(routeRecord());
  const routeUpdate = jest.fn().mockResolvedValue(routeRecord());
  const routeFindFirst = jest.fn().mockResolvedValue({
    id: routeId,
    originCityId,
    destinationCityId,
  });
  const routeFindUnique = jest.fn().mockResolvedValue({
    schedules: [scheduleRecord()],
  });
  const scheduleCount = jest.fn().mockResolvedValue(0);
  const scheduleCreate = jest.fn().mockResolvedValue(scheduleRecord());
  const scheduleUpdate = jest.fn().mockResolvedValue(scheduleRecord());
  const scheduleFindFirst = jest.fn().mockResolvedValue({
    id: scheduleId,
    departureAt: new Date('2026-10-01T08:00:00.000Z'),
    arrivalAt: new Date('2026-10-01T12:00:00.000Z'),
  });
  const prisma = {
    user: { findFirst: userFindFirst },
    service: { findFirst: serviceFindFirst },
    transportDetail: { upsert: detailUpsert },
    city: { count: cityCount },
    transportRoute: {
      count: routeCount,
      create: routeCreate,
      update: routeUpdate,
      findFirst: routeFindFirst,
      findUnique: routeFindUnique,
    },
    transportSchedule: {
      count: scheduleCount,
      create: scheduleCreate,
      update: scheduleUpdate,
      findFirst: scheduleFindFirst,
    },
  } as unknown as PrismaService;
  const businesses = { requireMembership } as unknown as BusinessesService;
  return {
    transports: new TransportsService(prisma, businesses),
    prisma,
    requireMembership,
    userFindFirst,
    serviceFindFirst,
    detailUpsert,
    cityCount,
    routeCount,
    routeCreate,
    routeUpdate,
    routeFindFirst,
    scheduleCount,
    scheduleCreate,
    scheduleUpdate,
    scheduleFindFirst,
  };
}

describe('Phase 14E transport service', () => {
  it('allows active STAFF to read and OWNER or MANAGER to write a TRANSPORT-family service', async () => {
    const staff = fixture();
    staff.requireMembership.mockResolvedValue({
      role: BusinessMemberRole.STAFF,
    });
    await expect(
      staff.transports.findMine(userId, businessId, serviceId),
    ).resolves.toMatchObject({
      service: { category: { family: ServiceCategoryFamily.TRANSPORT } },
    });

    const manager = fixture();
    manager.requireMembership.mockResolvedValue({
      role: BusinessMemberRole.MANAGER,
    });
    await manager.transports.updateDetail(userId, businessId, serviceId, {
      mode: ' BUS ',
      operatorName: ' Operator ',
    });
    expect(manager.detailUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { mode: 'BUS', operatorName: 'Operator' },
      }),
    );
  });

  it.each([
    ['TOUR', ServiceCategoryFamily.TOUR],
    ['MEAL', ServiceCategoryFamily.RESTAURANT],
    ['ROOM', ServiceCategoryFamily.ACCOMMODATION],
    ['GENERAL', ServiceCategoryFamily.OTHER],
  ])('rejects %s outside the TRANSPORT family', async (code, family) => {
    const current = fixture(serviceRecord({ code, family }));
    await expect(
      current.transports.updateDetail(userId, businessId, serviceId, {
        mode: 'BUS',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(current.detailUpsert).not.toHaveBeenCalled();
  });

  it('accepts a future TRANSPORT family category without code or name matching', async () => {
    const current = fixture(
      serviceRecord({
        code: 'BUS_TRANSFER',
        family: ServiceCategoryFamily.TRANSPORT,
      }),
    );
    await expect(
      current.transports.findMine(userId, businessId, serviceId),
    ).resolves.toMatchObject({
      service: { category: { code: 'BUS_TRANSFER' } },
    });
  });

  it('requires two distinct active City rows and scopes routes through the Service', async () => {
    const current = fixture();
    await expect(
      current.transports.createRoute(userId, businessId, serviceId, {
        originCityId,
        destinationCityId: originCityId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    current.cityCount.mockResolvedValue(1);
    await expect(
      current.transports.createRoute(userId, businessId, serviceId, {
        originCityId,
        destinationCityId,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(current.routeCreate).not.toHaveBeenCalled();
  });

  it('enforces retained-route and retained-schedule bounds', async () => {
    const atRouteLimit = fixture();
    atRouteLimit.routeCount.mockResolvedValue(MAX_TRANSPORT_ROUTES);
    await expect(
      atRouteLimit.transports.createRoute(userId, businessId, serviceId, {
        originCityId,
        destinationCityId,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(atRouteLimit.routeCreate).not.toHaveBeenCalled();

    const atScheduleLimit = fixture();
    atScheduleLimit.scheduleCount.mockResolvedValue(
      MAX_TRANSPORT_SCHEDULES_PER_ROUTE,
    );
    await expect(
      atScheduleLimit.transports.createSchedule(
        userId,
        businessId,
        serviceId,
        routeId,
        {
          departureAt: '2026-10-01T08:00:00.000Z',
          arrivalAt: '2026-10-01T12:00:00.000Z',
          fare: '0',
          currency: 'ETB',
          capacity: 1,
        },
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(atScheduleLimit.scheduleCreate).not.toHaveBeenCalled();
    expect(atScheduleLimit.scheduleCount).toHaveBeenCalledWith({
      where: { routeId },
    });
  });

  it('enforces schedule chronology and serializes Decimal fare without financial float arithmetic', async () => {
    const current = fixture();
    await expect(
      current.transports.createSchedule(
        userId,
        businessId,
        serviceId,
        routeId,
        {
          departureAt: '2026-10-01T08:00:00.000Z',
          arrivalAt: '2026-10-01T08:00:00.000Z',
          fare: '250.00',
          currency: 'ETB',
          capacity: 24,
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      current.transports.findMine(userId, businessId, serviceId),
    ).resolves.toMatchObject({
      routes: [{ schedules: [{ fare: '250.00', currency: 'ETB' }] }],
    });
  });

  it('denies STAFF writes, inactive users, inactive members, non-members, and cross-business route or schedule UUIDs', async () => {
    const staff = fixture();
    staff.requireMembership.mockImplementation(
      (_user: string, _business: string, roles: BusinessMemberRole[]) =>
        roles.includes(BusinessMemberRole.STAFF)
          ? Promise.resolve({ role: BusinessMemberRole.STAFF })
          : Promise.reject(new ForbiddenException()),
    );
    await expect(
      staff.transports.updateDetail(userId, businessId, serviceId, {
        mode: 'BUS',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      staff.transports.createRoute(userId, businessId, serviceId, {
        originCityId,
        destinationCityId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      staff.transports.createSchedule(userId, businessId, serviceId, routeId, {
        departureAt: '2026-10-01T08:00:00.000Z',
        arrivalAt: '2026-10-01T12:00:00.000Z',
        fare: '250.00',
        currency: 'ETB',
        capacity: 24,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const inactiveUser = fixture();
    inactiveUser.userFindFirst.mockResolvedValue(null);
    await expect(
      inactiveUser.transports.updateDetail(userId, businessId, serviceId, {
        mode: 'BUS',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    const activeFixture = fixture();
    const memberships = {
      businessMember: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    const denied = new TransportsService(
      activeFixture.prisma,
      new BusinessesService(memberships),
    );
    await expect(
      denied.createRoute(userId, businessId, serviceId, {
        originCityId,
        destinationCityId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(memberships.businessMember.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: BusinessMemberStatus.ACTIVE }),
      }),
    );

    const crossDetail = fixture();
    crossDetail.serviceFindFirst.mockResolvedValue(null);
    await expect(
      crossDetail.transports.updateDetail(userId, businessId, serviceId, {
        mode: 'BUS',
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(crossDetail.detailUpsert).not.toHaveBeenCalled();

    const crossBusiness = fixture();
    crossBusiness.routeFindFirst.mockResolvedValue(null);
    await expect(
      crossBusiness.transports.updateRoute(
        userId,
        businessId,
        serviceId,
        routeId,
        { originCityId },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(crossBusiness.routeUpdate).not.toHaveBeenCalled();
    await expect(
      crossBusiness.transports.createSchedule(
        userId,
        businessId,
        serviceId,
        routeId,
        {
          departureAt: '2026-10-01T08:00:00.000Z',
          arrivalAt: '2026-10-01T12:00:00.000Z',
          fare: '250.00',
          currency: 'ETB',
          capacity: 24,
        },
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      crossBusiness.transports.setScheduleActive(
        userId,
        businessId,
        serviceId,
        routeId,
        scheduleId,
        false,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(crossBusiness.scheduleUpdate).not.toHaveBeenCalled();
  });

  it('preserves the same schedule row for explicit deactivate and reactivate actions', async () => {
    const current = fixture();
    await current.transports.setScheduleActive(
      userId,
      businessId,
      serviceId,
      routeId,
      scheduleId,
      false,
    );
    await current.transports.setScheduleActive(
      userId,
      businessId,
      serviceId,
      routeId,
      scheduleId,
      true,
    );
    expect(current.scheduleUpdate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { id: scheduleId },
        data: { isActive: false },
      }),
    );
    expect(current.scheduleUpdate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: { id: scheduleId },
        data: { isActive: true },
      }),
    );
  });

  it('does not mutate transport data for archived services', async () => {
    const current = fixture(serviceRecord({ status: ServiceStatus.ARCHIVED }));
    await expect(
      current.transports.updateDetail(userId, businessId, serviceId, {
        mode: 'BUS',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
