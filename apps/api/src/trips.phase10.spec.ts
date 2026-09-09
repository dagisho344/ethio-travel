import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { TripItemType, TripStatus, UserStatus } from '@prisma/client';
import { TripsService } from './trips/trips.service';

const userId = '11111111-1111-4111-8111-111111111111';
const otherUserId = '22222222-2222-4222-8222-222222222222';
const tripId = '33333333-3333-4333-8333-333333333333';
const dayId = '44444444-4444-4444-8444-444444444444';
const itemId = '55555555-5555-4555-8555-555555555555';
const secondItemId = '66666666-6666-4666-8666-666666666666';
const targetId = '77777777-7777-4777-8777-777777777777';
const bookingId = '88888888-8888-4888-888888888888';

function item(overrides: Record<string, unknown> = {}) {
  return {
    id: itemId,
    type: TripItemType.CUSTOM,
    destinationId: null,
    attractionId: null,
    businessId: null,
    serviceId: null,
    bookingId: null,
    titleSnapshot: 'Coffee break',
    startTime: null,
    endTime: null,
    position: 0,
    notes: null,
    createdAt: new Date('2030-01-01T00:00:00.000Z'),
    updatedAt: new Date('2030-01-01T00:00:00.000Z'),
    booking: null,
    ...overrides,
  };
}

function day(overrides: Record<string, unknown> = {}) {
  return {
    id: dayId,
    date: new Date('2030-06-10T00:00:00.000Z'),
    dayNumber: 1,
    notes: null,
    createdAt: new Date('2030-01-01T00:00:00.000Z'),
    updatedAt: new Date('2030-01-01T00:00:00.000Z'),
    items: [item()],
    ...overrides,
  };
}

function trip(overrides: Record<string, unknown> = {}) {
  return {
    id: tripId,
    userId,
    title: 'Northern circuit',
    originCityId: null,
    destinationCityId: null,
    primaryDestinationId: null,
    startDate: new Date('2030-06-10T00:00:00.000Z'),
    endDate: new Date('2030-06-12T00:00:00.000Z'),
    status: TripStatus.DRAFT,
    notes: null,
    archivedAt: null,
    createdAt: new Date('2030-01-01T00:00:00.000Z'),
    updatedAt: new Date('2030-01-01T00:00:00.000Z'),
    originCity: null,
    destinationCity: null,
    primaryDestination: null,
    days: [day()],
    ...overrides,
  };
}

function setup() {
  const tx = {
    trip: {
      create: jest.fn().mockResolvedValue({ id: tripId }),
      findUniqueOrThrow: jest.fn().mockResolvedValue(trip()),
      update: jest.fn().mockResolvedValue(trip()),
    },
    tripDay: {
      createMany: jest.fn().mockResolvedValue({ count: 3 }),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
      findUniqueOrThrow: jest.fn().mockResolvedValue(day()),
    },
    tripItem: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn().mockResolvedValue(item()),
      findFirst: jest.fn().mockResolvedValue(null),
      findMany: jest
        .fn()
        .mockResolvedValue([{ id: itemId }, { id: secondItemId }]),
      update: jest.fn(),
      delete: jest.fn(),
      updateMany: jest.fn(),
    },
    city: { findUnique: jest.fn().mockResolvedValue({ id: targetId }) },
    destination: {
      findFirst: jest.fn().mockResolvedValue({
        id: targetId,
        name: 'Lalibela',
        cityId: targetId,
      }),
    },
    attraction: {
      findFirst: jest.fn().mockResolvedValue({ id: targetId, name: 'Church' }),
    },
    business: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: targetId, name: 'Guest house' }),
    },
    service: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: targetId, name: 'Guided tour' }),
    },
    booking: {
      findFirst: jest.fn().mockResolvedValue({
        id: bookingId,
        reference: 'ET-100',
        service: { name: 'Tour' },
      }),
    },
    $executeRaw: jest.fn().mockResolvedValue(1),
  };
  const prisma = {
    user: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: userId, status: UserStatus.ACTIVE }),
    },
    trip: {
      findFirst: jest.fn().mockResolvedValue(trip()),
      findMany: jest
        .fn()
        .mockResolvedValue([{ ...trip(), _count: { days: 1 } }]),
      count: jest.fn().mockResolvedValue(1),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    tripDay: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: dayId, trip: { status: TripStatus.DRAFT } }),
      findMany: jest.fn().mockResolvedValue([day()]),
      update: jest.fn().mockResolvedValue(day()),
    },
    tripItem: { findFirst: jest.fn().mockResolvedValue(item()) },
    city: { findUnique: jest.fn().mockResolvedValue({ id: targetId }) },
    destination: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: targetId, cityId: targetId }),
    },
    $transaction: jest.fn((callback: unknown) => {
      if (typeof callback !== 'function') return Promise.resolve(callback);
      return callback(tx);
    }),
  };
  return { prisma, service: new TripsService(prisma as never), tx };
}

describe('TripsService', () => {
  it('creates an owned trip and deterministically generates one TripDay per calendar date', async () => {
    const { service, tx } = setup();
    const result = await service.create(userId, {
      title: ' Northern circuit ',
      startDate: '2030-06-10',
      endDate: '2030-06-12',
    });
    expect(result.title).toBe('Northern circuit');
    expect(tx.tripDay.createMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({ dayNumber: 1 }),
          expect.objectContaining({ dayNumber: 3 }),
        ]),
      }),
    );
  });

  it('rejects invalid calendar ranges before a trip is persisted', async () => {
    const { service, prisma } = setup();
    await expect(
      service.create(userId, {
        title: 'Trip',
        startDate: '2030-06-12',
        endDate: '2030-06-10',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('lists only the current user trips with server-scoped pagination', async () => {
    const { service, prisma } = setup();
    await service.findMine(userId, {
      page: 2,
      limit: 5,
      sort: 'SOONEST' as never,
    });
    expect(prisma.trip.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId }),
        skip: 5,
        take: 5,
      }),
    );
  });

  it('does not reveal another user trip by a guessed UUID', async () => {
    const { service, prisma } = setup();
    prisma.trip.findFirst.mockResolvedValue(null);
    await expect(service.findOne(otherUserId, tripId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.trip.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: tripId, userId: otherUserId } }),
    );
  });

  it('archives without deleting itinerary history and makes the trip read-only', async () => {
    const { service, prisma } = setup();
    prisma.trip.updateMany.mockResolvedValue({ count: 0 });
    prisma.trip.findFirst
      .mockResolvedValueOnce({ id: tripId })
      .mockResolvedValueOnce(
        trip({ status: TripStatus.ARCHIVED, archivedAt: new Date() }),
      );
    const archived = await service.archive(userId, tripId);
    expect(archived.status).toBe(TripStatus.ARCHIVED);
    expect(prisma.trip.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: TripStatus.ARCHIVED }),
      }),
    );
  });

  it.each([
    [TripItemType.DESTINATION, 'destinationId'],
    [TripItemType.ATTRACTION, 'attractionId'],
    [TripItemType.BUSINESS, 'businessId'],
    [TripItemType.SERVICE, 'serviceId'],
  ])(
    'adds a public %s item only when its target type matches',
    async (type, field) => {
      const { service, tx } = setup();
      await service.addItem(userId, tripId, dayId, { type, [field]: targetId });
      expect(tx.tripItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            type,
            [field]: targetId,
            position: 0,
          }),
        }),
      );
    },
  );

  it('rejects a mismatched item target/type combination', async () => {
    const { service } = setup();
    await expect(
      service.addItem(userId, tripId, dayId, {
        type: TripItemType.SERVICE,
        businessId: targetId,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows only an owned booking, and prevents a duplicate booking association in the same trip', async () => {
    const { service, tx } = setup();
    await service.addItem(userId, tripId, dayId, {
      type: TripItemType.BOOKING,
      bookingId,
    });
    expect(tx.booking.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: bookingId, travelerId: userId } }),
    );
    tx.tripItem.findFirst.mockResolvedValue({ id: itemId });
    await expect(
      service.addItem(userId, tripId, dayId, {
        type: TripItemType.BOOKING,
        bookingId,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects another traveler booking association without exposing it', async () => {
    const { service, tx } = setup();
    tx.booking.findFirst.mockResolvedValue(null);
    await expect(
      service.addItem(userId, tripId, dayId, {
        type: TripItemType.BOOKING,
        bookingId,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removes only the itinerary association and compacts positions', async () => {
    const { service, tx } = setup();
    tx.tripItem.findFirst.mockResolvedValue({ id: itemId, position: 1 });
    await service.removeItem(userId, tripId, dayId, itemId);
    expect(tx.tripItem.delete).toHaveBeenCalledWith({ where: { id: itemId } });
    expect(tx.tripItem.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tripDayId: dayId, position: { gt: 1 } },
      }),
    );
  });

  it('reorders the complete day transactionally and rejects position collisions', async () => {
    const { service, tx } = setup();
    await service.reorderItems(userId, tripId, dayId, {
      itemIds: [secondItemId, itemId],
    });
    expect(tx.tripItem.update).toHaveBeenCalledTimes(4);
    await expect(
      service.reorderItems(userId, tripId, dayId, { itemIds: [itemId] }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('denies cross-trip day mutations before an item is read', async () => {
    const { service, prisma } = setup();
    prisma.tripDay.findFirst.mockResolvedValue(null);
    await expect(
      service.removeItem(userId, tripId, dayId, itemId),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.tripItem.findFirst).not.toHaveBeenCalled();
  });

  it('refuses date removal when an out-of-range day contains itinerary items', async () => {
    const { service, prisma } = setup();
    prisma.trip.findFirst.mockResolvedValueOnce(
      trip({
        days: [
          {
            id: dayId,
            date: new Date('2030-06-10T00:00:00.000Z'),
            dayNumber: 1,
            items: [],
          },
          {
            id: '99999999-9999-4999-8999-999999999999',
            date: new Date('2030-06-12T00:00:00.000Z'),
            dayNumber: 3,
            items: [{ id: itemId }],
          },
        ],
      }),
    );
    await expect(
      service.update(userId, tripId, { endDate: '2030-06-11' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
