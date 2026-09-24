import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  TripBudgetCategory,
  TripStatus,
  UserStatus,
} from '@prisma/client';
import { TripsService } from './trips/trips.service';

const userId = '11111111-1111-4111-8111-111111111111';
const otherUserId = '22222222-2222-4222-8222-222222222222';
const tripId = '33333333-3333-4333-8333-333333333333';
const expenseId = '44444444-4444-4444-8444-444444444444';

type BudgetUpsertInput = {
  create: { amount: Prisma.Decimal; currency: string; tripId: string };
  select: unknown;
  update: { amount: Prisma.Decimal; currency: string };
  where: { tripId: string };
};

function budget(
  expenses: Array<{
    id: string;
    category: TripBudgetCategory;
    amount: Prisma.Decimal;
    note: string | null;
  }> = [],
) {
  return {
    id: '55555555-5555-4555-8555-555555555555',
    amount: new Prisma.Decimal('1000.00'),
    currency: 'ETB',
    createdAt: new Date(),
    updatedAt: new Date(),
    expenses: expenses.map((expense) => ({
      ...expense,
      createdAt: new Date(),
      updatedAt: new Date(),
    })),
  };
}

function trip(overrides: Record<string, unknown> = {}) {
  return {
    id: tripId,
    userId,
    title: 'Budget trip',
    startDate: new Date('2030-06-10T00:00:00.000Z'),
    endDate: new Date('2030-06-12T00:00:00.000Z'),
    status: TripStatus.DRAFT,
    notes: null,
    archivedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    originCity: null,
    destinationCity: null,
    primaryDestination: null,
    days: [],
    budget: budget(),
    ...overrides,
  };
}

function setup(
  overrides: {
    status?: TripStatus;
    expenseCount?: number;
    currency?: string;
  } = {},
) {
  const record = trip({ status: overrides.status ?? TripStatus.DRAFT });
  const budgetUpsert = jest
    .fn<Promise<ReturnType<typeof budget>>, [BudgetUpsertInput]>()
    .mockResolvedValue(record.budget);
  const tx = {
    tripBudget: {
      findUnique: jest.fn().mockResolvedValue({
        id: record.budget.id,
        currency: overrides.currency ?? 'ETB',
        _count: { expenses: overrides.expenseCount ?? 0 },
      }),
      upsert: budgetUpsert,
      delete: jest.fn(),
    },
    tripPlannedExpense: {
      count: jest.fn().mockResolvedValue(overrides.expenseCount ?? 0),
      create: jest.fn(),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma = {
    user: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: userId, status: UserStatus.ACTIVE }),
    },
    trip: { findFirst: jest.fn().mockResolvedValue(record) },
    tripBudget: { findUnique: jest.fn() },
    tripPlannedExpense: {
      findFirst: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn((callback: (client: typeof tx) => Promise<unknown>) =>
      callback(tx),
    ),
  };
  return {
    budgetUpsert,
    service: new TripsService(prisma as never),
    prisma,
    tx,
  };
}

describe('Phase 16B Trip Budget', () => {
  it('stores positive Decimal budget amounts with the supported ETB currency', async () => {
    const { budgetUpsert, service } = setup({ currency: 'ETB' });
    await service.upsertBudget(userId, tripId, {
      amount: '1500.25',
      currency: 'ETB',
    });
    const input = budgetUpsert.mock.calls[0]?.[0];
    expect(input).toBeDefined();
    expect(input?.create.tripId).toBe(tripId);
    expect(input?.create.currency).toBe('ETB');
    expect(input?.create.amount.equals(new Prisma.Decimal('1500.25'))).toBe(
      true,
    );
  });

  it('does not reveal a budget for another traveler trip', async () => {
    const { service, prisma } = setup();
    prisma.trip.findFirst.mockResolvedValue(null);
    await expect(service.budget(otherUserId, tripId)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.trip.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: tripId, userId: otherUserId } }),
    );
  });

  it('keeps archived trip budgets read-only', async () => {
    const { service, tx } = setup({ status: TripStatus.ARCHIVED });
    await expect(
      service.upsertBudget(userId, tripId, { amount: '1.00', currency: 'ETB' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.tripBudget.upsert).not.toHaveBeenCalled();
  });

  it('rejects currency changes while planned expenses exist', async () => {
    const { service } = setup({ expenseCount: 1, currency: 'ETB' });
    await expect(
      service.upsertBudget(userId, tripId, {
        amount: '1000.00',
        currency: 'USD',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects syntactically valid but unsupported ISO currency codes', async () => {
    const { service } = setup();
    await expect(
      service.upsertBudget(userId, tripId, {
        amount: '1000.00',
        currency: 'ZZZ',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates the one hundredth planned expense but rejects another', async () => {
    const { service, tx } = setup({ expenseCount: 99 });
    await service.createPlannedExpense(userId, tripId, {
      category: TripBudgetCategory.FOOD,
      amount: '10.00',
    });
    expect(tx.tripPlannedExpense.create).toHaveBeenCalledTimes(1);
  });

  it('enforces the transactional 100 planned-expense limit', async () => {
    const { service, tx } = setup({ expenseCount: 100 });
    await expect(
      service.createPlannedExpense(userId, tripId, {
        category: TripBudgetCategory.FOOD,
        amount: '10.00',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.tripPlannedExpense.create).not.toHaveBeenCalled();
  });

  it('deletes only budget-owned planned expenses and the budget in one transaction', async () => {
    const { service, tx } = setup();
    await service.deleteBudget(userId, tripId);
    expect(tx.tripPlannedExpense.deleteMany).toHaveBeenCalledWith({
      where: { budgetId: '55555555-5555-4555-8555-555555555555' },
    });
    expect(tx.tripBudget.delete).toHaveBeenCalledWith({
      where: { id: '55555555-5555-4555-8555-555555555555' },
    });
  });

  it('keeps booking estimates separate from planned totals', async () => {
    const planned = budget([
      {
        id: expenseId,
        category: TripBudgetCategory.FOOD,
        amount: new Prisma.Decimal('300'),
        note: null,
      },
    ]);
    const { service, prisma } = setup();
    prisma.trip.findFirst.mockResolvedValue(
      trip({
        budget: planned,
        days: [
          {
            id: '66666666-6666-4666-8666-666666666666',
            date: new Date(),
            dayNumber: 1,
            notes: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            items: [
              {
                id: '77777777-7777-4777-8777-777777777777',
                type: 'BOOKING',
                destinationId: null,
                attractionId: null,
                businessId: null,
                serviceId: null,
                bookingId: '88888888-8888-4888-8888-888888888888',
                titleSnapshot: null,
                startTime: null,
                endTime: null,
                position: 0,
                notes: null,
                createdAt: new Date(),
                updatedAt: new Date(),
                booking: {
                  id: '88888888-8888-4888-8888-888888888888',
                  reference: 'ET-1',
                  startAt: new Date(),
                  endAt: new Date(),
                  subtotal: new Prisma.Decimal('700'),
                  currency: 'ETB',
                  bookingStatus: 'CONFIRMED',
                  paymentStatus: 'PAID',
                  service: { id: 's', name: 'Service', slug: 'service' },
                  business: { id: 'b', name: 'Business', slug: 'business' },
                },
              },
            ],
          },
        ],
      }),
    );
    const result = await service.findOne(userId, tripId);
    expect(result.budget?.plannedTotal).toBe('300');
    expect(result.budget?.remainingAmount).toBe('700');
    expect(result.estimatedBookingCost?.amount).toBe('700');
  });
});
