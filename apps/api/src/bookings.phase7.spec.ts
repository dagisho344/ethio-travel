import {
  BookingMode,
  BookingStatus,
  BusinessStatus,
  BusinessVerificationSummary,
  PaymentStatus,
  PricingModel,
} from '@prisma/client';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { BookingsService } from './bookings/bookings.service';

type BookingCreateArg = {
  data: {
    businessId: string;
    travelerId: string;
    paymentStatus: PaymentStatus;
    subtotal: number;
    bookingModeSnapshot: BookingMode;
    history: { create: { toStatus: BookingStatus } };
  };
};

const futureStart = () =>
  new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
const futureEnd = () =>
  new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString();

function serviceFactory(overrides = {}) {
  return {
    id: 'service-id',
    businessId: 'business-id',
    pricingModel: PricingModel.PER_PERSON,
    price: { mul: (quantity: number) => 100 * quantity } as never,
    currency: 'ETB',
    bookingConfig: {
      enabled: true,
      bookingMode: BookingMode.TIME_SLOT,
      timezone: 'Africa/Addis_Ababa',
      capacity: 2,
      minQuantity: 1,
      maxQuantity: 2,
      minDurationMinutes: 30,
      maxDurationMinutes: 180,
      advanceNoticeMinutes: 0,
    },
    business: {
      status: BusinessStatus.ACTIVE,
      verificationSummary: BusinessVerificationSummary.VERIFIED,
    },
    ...overrides,
  };
}

describe('BookingsService', () => {
  function setup() {
    const tx = {
      $executeRaw: jest.fn(),
      service: { findFirst: jest.fn(), findUnique: jest.fn() },
      serviceAvailabilityOverride: { findFirst: jest.fn() },
      serviceAvailabilityRule: { findFirst: jest.fn() },
      booking: {
        aggregate: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
      },
      bookingStatusHistory: { create: jest.fn() },
    };
    const prisma = {
      user: { findFirst: jest.fn().mockResolvedValue({ id: 'user-id' }) },
      booking: {
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        updateMany: jest.fn(),
        aggregate: jest.fn(),
      },
      service: { findFirst: jest.fn(), findUnique: jest.fn() },
      serviceBookingConfig: { upsert: jest.fn() },
      serviceAvailabilityRule: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        deleteMany: jest.fn(),
      },
      serviceAvailabilityOverride: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
        findUniqueOrThrow: jest.fn(),
        deleteMany: jest.fn(),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    };
    const businesses = { requireMembership: jest.fn() };
    const service = new BookingsService(prisma as never, businesses as never);
    return { service, prisma, tx, businesses };
  }

  it('creates eligible booking with server-side price snapshot and history', async () => {
    const { service, tx } = setup();
    tx.service.findFirst.mockResolvedValue(serviceFactory());
    tx.serviceAvailabilityOverride.findFirst.mockResolvedValue(null);
    tx.serviceAvailabilityRule.findFirst.mockResolvedValue(null);
    tx.booking.aggregate.mockResolvedValue({ _sum: { quantity: 0 } });
    let createArg: BookingCreateArg | undefined;
    tx.booking.create.mockImplementation((input: BookingCreateArg) => {
      createArg = input;
      return Promise.resolve({
        id: 'booking-id',
        bookingStatus: BookingStatus.PENDING,
      });
    });

    const result = await service.create('user-id', {
      serviceId: 'service-id',
      startAt: futureStart(),
      endAt: futureEnd(),
      quantity: 2,
    });

    expect(result).toEqual({
      id: 'booking-id',
      bookingStatus: BookingStatus.PENDING,
    });
    expect(tx.$executeRaw).toHaveBeenCalled();
    expect(tx.booking.create).toHaveBeenCalled();
    expect(createArg).toBeDefined();
    expect(createArg?.data.businessId).toBe('business-id');
    expect(createArg?.data.travelerId).toBe('user-id');
    expect(createArg?.data.paymentStatus).toBe(PaymentStatus.UNPAID);
    expect(createArg?.data.bookingModeSnapshot).toBe(BookingMode.TIME_SLOT);
    expect(createArg?.data.subtotal).toBe(200);
    expect(createArg?.data.history.create.toStatus).toBe(BookingStatus.PENDING);
  });

  it('rejects overbooking under the transaction lock', async () => {
    const { service, tx } = setup();
    tx.service.findFirst.mockResolvedValue(serviceFactory());
    tx.serviceAvailabilityOverride.findFirst.mockResolvedValue(null);
    tx.serviceAvailabilityRule.findFirst.mockResolvedValue(null);
    tx.booking.aggregate.mockResolvedValue({ _sum: { quantity: 2 } });
    await expect(
      service.create('user-id', {
        serviceId: 'service-id',
        startAt: futureStart(),
        endAt: futureEnd(),
        quantity: 1,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects non-public or disabled services', async () => {
    const { service, tx } = setup();
    tx.service.findFirst.mockResolvedValue(null);
    await expect(
      service.create('user-id', {
        serviceId: 'service-id',
        startAt: futureStart(),
        endAt: futureEnd(),
        quantity: 1,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('uses object membership for business booking access', async () => {
    const { service, businesses, prisma } = setup();
    businesses.requireMembership.mockRejectedValue(new ForbiddenException());
    await expect(
      service.findBusinessBookings('user-id', 'business-id', {
        page: 1,
        limit: 20,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.booking.findMany).not.toHaveBeenCalled();
  });

  it('rejects invalid booking transitions with 409', async () => {
    const { service, tx } = setup();
    tx.booking.findFirst.mockResolvedValue({
      id: 'booking-id',
      bookingStatus: BookingStatus.COMPLETED,
    });
    tx.booking.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.cancelMine('user-id', 'booking-id', {}),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('blocks inactive travelers', async () => {
    const { service, prisma } = setup();
    prisma.user.findFirst.mockResolvedValue(null);
    await expect(
      service.findMine('user-id', { page: 1, limit: 20 }),
    ).rejects.toThrow('Authentication required.');
  });
});
