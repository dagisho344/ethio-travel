import { BusinessMemberRole, BookingStatus } from '@prisma/client';
import { BusinessOperationsService } from './business-operations/business-operations.service';
import { BusinessesService } from './businesses/businesses.service';
import { PrismaService } from './prisma/prisma.service';

const userId = '11111111-1111-4111-8111-111111111111';
const businessId = '22222222-2222-4222-8222-222222222222';
const reviewId = '33333333-3333-4333-8333-333333333333';

describe('Phase 12D business operations', () => {
  function membership() {
    return {
      requireMembership: jest
        .fn()
        .mockResolvedValue({ role: BusinessMemberRole.OWNER }),
    } as unknown as BusinessesService;
  }

  it('derives revenue only from successful captured transactions and completed refunds, grouped by currency', async () => {
    const capturedGroupBy = jest
      .fn()
      .mockResolvedValue([{ currency: 'ETB', _sum: { amount: '125.50' } }]);
    const refundedGroupBy = jest.fn().mockResolvedValue([
      { currency: 'ETB', _sum: { amount: '25.00' } },
      { currency: 'USD', _sum: { amount: '1.00' } },
    ]);
    const prisma = {
      business: {
        findUnique: jest.fn().mockResolvedValue({
          id: businessId,
          name: 'Business',
          status: 'ACTIVE',
          verificationSummary: 'VERIFIED',
          city: { id: 'city', name: 'Addis' },
          destination: null,
        }),
      },
      businessLocation: { findFirst: jest.fn().mockResolvedValue(null) },
      service: { count: jest.fn().mockResolvedValue(2) },
      booking: { count: jest.fn().mockResolvedValue(1) },
      review: {
        aggregate: jest
          .fn()
          .mockResolvedValue({ _avg: { rating: 4.2 }, _count: { _all: 3 } }),
        count: jest.fn().mockResolvedValue(1),
      },
      paymentTransaction: { groupBy: capturedGroupBy },
      paymentRefund: { groupBy: refundedGroupBy },
    } as unknown as PrismaService;
    const service = new BusinessOperationsService(prisma, membership());

    const summary = await service.dashboard(userId, businessId);

    expect(summary.revenue).toEqual([
      { currency: 'ETB', gross: '125.50', refunded: '25.00', net: '100.50' },
      { currency: 'USD', gross: '0.00', refunded: '1.00', net: '-1.00' },
    ]);
    expect(capturedGroupBy).toHaveBeenCalledTimes(1);
    expect(refundedGroupBy).toHaveBeenCalledTimes(1);
  });

  it('permits an owner to upsert an official response only on that business published review', async () => {
    const upsert = jest.fn().mockResolvedValue({
      id: 'response',
      body: 'Thank you',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const findReview = jest.fn().mockResolvedValue({ id: reviewId });
    const prisma = {
      review: { findFirst: findReview },
      reviewResponse: { upsert },
    } as unknown as PrismaService;
    const service = new BusinessOperationsService(prisma, membership());

    await expect(
      service.upsertReviewResponse(userId, businessId, reviewId, {
        body: ' Thank you ',
      }),
    ).resolves.toEqual(expect.objectContaining({ body: 'Thank you' }));
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(findReview).toHaveBeenCalledTimes(1);
  });

  it('derives customers from bookings only and returns no email or authentication fields', async () => {
    const groupBy = jest.fn();
    groupBy
      .mockResolvedValueOnce([
        {
          travelerId: userId,
          bookingStatus: BookingStatus.COMPLETED,
          _count: { _all: 2 },
          _max: { createdAt: new Date('2026-01-02') },
        },
      ])
      .mockResolvedValueOnce([{ travelerId: userId, _count: { _all: 1 } }]);
    const prisma = {
      booking: { groupBy },
      user: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            { id: userId, profile: { firstName: 'Aster', lastName: 'T.' } },
          ]),
      },
    } as unknown as PrismaService;
    const service = new BusinessOperationsService(prisma, membership());

    const result = await service.customers(userId, businessId, {
      page: 1,
      limit: 20,
    });

    expect(result.data).toEqual([
      expect.objectContaining({
        userId,
        displayName: 'Aster T.',
        bookingCount: 2,
        completedBookingCount: 2,
        upcomingBookingCount: 1,
      }),
    ]);
    expect(JSON.stringify(result.data)).not.toContain('email');
    expect(JSON.stringify(result.data)).not.toContain('password');
  });
});
