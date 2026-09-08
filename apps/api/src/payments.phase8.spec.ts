/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import {
  BookingStatus,
  PaymentProvider,
  PaymentRefundStatus,
  PaymentStatus,
  PaymentTransactionType,
  PaymentWebhookProcessingStatus,
  Prisma,
  UserStatus,
} from '@prisma/client';
import { PaymentsService } from './payments/payments.service';

const travelerId = '11111111-1111-4111-8111-111111111111';
const otherTravelerId = '99999999-9999-4999-8999-999999999999';
const bookingId = '22222222-2222-4222-8222-222222222222';
const businessId = '33333333-3333-4333-8333-333333333333';
const paymentId = '44444444-4444-4444-8444-444444444444';

function booking(overrides = {}) {
  return {
    id: bookingId,
    businessId,
    travelerId,
    bookingStatus: BookingStatus.PENDING,
    paymentStatus: PaymentStatus.UNPAID,
    subtotal: new Prisma.Decimal(120),
    currency: 'ETB',
    ...overrides,
  };
}

function payment(overrides = {}) {
  return {
    id: paymentId,
    bookingId,
    travelerId,
    businessId,
    provider: PaymentProvider.DEVELOPMENT,
    providerPaymentId: 'dev_pay_1',
    amount: new Prisma.Decimal(120),
    currency: 'ETB',
    status: PaymentStatus.PENDING,
    method: null,
    paidAt: null,
    failedAt: null,
    createdAt: new Date('2030-01-01T00:00:00.000Z'),
    updatedAt: new Date('2030-01-01T00:00:00.000Z'),
    booking: {
      id: bookingId,
      reference: 'ETB-BOOKING',
      bookingStatus: BookingStatus.PENDING,
      paymentStatus: PaymentStatus.PENDING,
      service: { id: 'service-id', name: 'Room stay', slug: 'room-stay' },
      business: { id: businessId, name: 'Demo Guest House', slug: 'demo' },
    },
    transactions: [],
    refunds: [],
    ...overrides,
  };
}

function uniqueError() {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    clientVersion: 'test',
    code: 'P2002',
  });
}

function setup() {
  const tx = {
    $executeRaw: jest.fn(),
    booking: {
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    payment: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    paymentTransaction: { create: jest.fn() },
    paymentWebhookEvent: { update: jest.fn() },
    paymentRefund: {
      aggregate: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };
  const prisma = {
    user: {
      findFirst: jest
        .fn()
        .mockResolvedValue({ id: travelerId, status: UserStatus.ACTIVE }),
    },
    booking: {
      findFirst: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    payment: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    paymentTransaction: { create: jest.fn() },
    paymentWebhookEvent: {
      create: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
    paymentRefund: {
      aggregate: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((input: unknown) => {
      if (Array.isArray(input)) return Promise.all(input);
      return (input as (client: typeof tx) => unknown)(tx);
    }),
  };
  const businesses = { requireMembership: jest.fn() };
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'paymentProvider') return PaymentProvider.DEVELOPMENT;
      if (key === 'paymentDevelopmentWebhookSecret') {
        return 'development-payment-webhook-secret-change-me';
      }
      return undefined;
    }),
  };
  const gateway = {
    provider: PaymentProvider.DEVELOPMENT,
    createPayment: jest.fn(() =>
      Promise.resolve({
        provider: PaymentProvider.DEVELOPMENT,
        providerPaymentId: 'dev_pay_1',
        status: PaymentStatus.PENDING,
        safeResponse: {
          provider: 'DEVELOPMENT',
          paymentReference: 'dev_pay_1',
        },
      }),
    ),
    verifyWebhook: jest.fn(),
    refundPayment: jest.fn(() =>
      Promise.resolve({ providerRefundId: 'dev_ref_1', succeeded: true }),
    ),
  };
  const service = new PaymentsService(
    prisma as never,
    businesses as never,
    config as never,
    gateway,
  );
  return { service, prisma, tx, businesses, gateway };
}

describe('PaymentsService', () => {
  it('creates payment for owned booking using server-side booking snapshot', async () => {
    const { service, tx, gateway } = setup();
    tx.booking.findFirst.mockResolvedValue(booking());
    tx.payment.findFirst.mockResolvedValue(null);
    tx.payment.create.mockResolvedValue(payment({ providerPaymentId: null }));
    tx.payment.findUniqueOrThrow.mockResolvedValue(payment());

    const result = await service.createForBooking(
      travelerId,
      bookingId,
      { idempotencyKey: 'pay-test-001' },
      undefined,
    );

    expect(result.status).toBe(PaymentStatus.PENDING);
    expect(tx.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          amount: new Prisma.Decimal(120),
          currency: 'ETB',
          travelerId,
          businessId,
        }),
      }),
    );
    expect(gateway.createPayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount: '120', currency: 'ETB' }),
    );
    expect(tx.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { paymentStatus: PaymentStatus.PENDING },
      }),
    );
  });

  it('rejects another user booking, unpaid-free booking, settled booking and cancelled booking', async () => {
    const { service, tx } = setup();
    tx.booking.findFirst.mockResolvedValueOnce(null);
    await expect(
      service.createForBooking(otherTravelerId, bookingId, {}, undefined),
    ).rejects.toBeInstanceOf(NotFoundException);

    tx.booking.findFirst.mockResolvedValueOnce(
      booking({ paymentStatus: PaymentStatus.NOT_REQUIRED }),
    );
    await expect(
      service.createForBooking(travelerId, bookingId, {}, undefined),
    ).rejects.toBeInstanceOf(ConflictException);

    tx.booking.findFirst.mockResolvedValueOnce(
      booking({ paymentStatus: PaymentStatus.PAID }),
    );
    await expect(
      service.createForBooking(travelerId, bookingId, {}, undefined),
    ).rejects.toThrow('already settled');

    tx.booking.findFirst.mockResolvedValueOnce(
      booking({ bookingStatus: BookingStatus.CANCELLED_BY_TRAVELER }),
    );
    await expect(
      service.createForBooking(travelerId, bookingId, {}, undefined),
    ).rejects.toThrow('not payable');
  });

  it('reuses pending active or idempotent payment attempts', async () => {
    const { service, tx, gateway } = setup();
    tx.booking.findFirst.mockResolvedValue(booking());
    tx.payment.findFirst
      .mockResolvedValueOnce(payment())
      .mockResolvedValueOnce(payment());
    const result = await service.createForBooking(
      travelerId,
      bookingId,
      {},
      'pay-header-001',
    );
    expect(result.id).toBe(paymentId);
    expect(gateway.createPayment).not.toHaveBeenCalled();
  });

  it('validates idempotency keys and active users', async () => {
    const { service, prisma } = setup();
    await expect(
      service.createForBooking(travelerId, bookingId, {}, 'bad'),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.user.findFirst.mockResolvedValue(null);
    await expect(
      service.createForBooking(travelerId, bookingId, {}, undefined),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('records provider failure safely during initiation', async () => {
    const { service, tx, gateway } = setup();
    tx.booking.findFirst.mockResolvedValue(booking());
    tx.payment.findFirst.mockResolvedValue(null);
    tx.payment.create.mockResolvedValue(payment({ providerPaymentId: null }));
    tx.payment.findUniqueOrThrow.mockResolvedValue(
      payment({ status: PaymentStatus.FAILED, failedAt: new Date() }),
    );
    (gateway.createPayment as jest.Mock).mockResolvedValue({
      provider: PaymentProvider.DEVELOPMENT,
      providerPaymentId: 'dev_pay_failed',
      status: PaymentStatus.FAILED,
      safeResponse: {
        provider: 'DEVELOPMENT',
        paymentReference: 'dev_pay_failed',
      },
    });

    const result = await service.createForBooking(
      travelerId,
      bookingId,
      {},
      undefined,
    );
    expect(result.status).toBe(PaymentStatus.FAILED);
    expect(tx.booking.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: { paymentStatus: PaymentStatus.FAILED },
      }),
    );
  });

  it('processes verified success webhook once and synchronizes booking payment status', async () => {
    const { service, prisma, tx, gateway } = setup();
    gateway.verifyWebhook.mockResolvedValue({
      provider: PaymentProvider.DEVELOPMENT,
      providerEventId: 'evt_paid_1',
      eventType: 'payment.paid',
      paymentId,
      providerPaymentId: 'dev_pay_1',
      status: PaymentStatus.PAID,
    });
    prisma.paymentWebhookEvent.create.mockResolvedValue({
      id: 'webhook-id',
      processingStatus: PaymentWebhookProcessingStatus.RECEIVED,
    });
    tx.payment.findFirst.mockResolvedValue(payment());
    tx.payment.updateMany.mockResolvedValue({ count: 1 });

    const result = await service.processWebhook(
      'DEVELOPMENT',
      { eventId: 'evt_paid_1' },
      'sig',
    );
    expect(result).toEqual({
      received: true,
      duplicate: false,
      processed: true,
    });
    expect(tx.booking.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { paymentStatus: PaymentStatus.PAID } }),
    );
    expect(tx.paymentTransaction.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: PaymentTransactionType.PAYMENT_CAPTURED,
        }),
      }),
    );
  });

  it('treats duplicate webhook events idempotently', async () => {
    const { service, prisma, gateway } = setup();
    gateway.verifyWebhook.mockResolvedValue({
      provider: PaymentProvider.DEVELOPMENT,
      providerEventId: 'evt_dup',
      eventType: 'payment.paid',
      paymentId,
      status: PaymentStatus.PAID,
    });
    prisma.paymentWebhookEvent.create.mockRejectedValue(uniqueError());
    prisma.paymentWebhookEvent.findUniqueOrThrow.mockResolvedValue({
      id: 'webhook-id',
      processingStatus: PaymentWebhookProcessingStatus.PROCESSED,
    });

    const result = await service.processWebhook(
      'DEVELOPMENT',
      { eventId: 'evt_dup' },
      'sig',
    );
    expect(result).toEqual({
      received: true,
      duplicate: true,
      status: PaymentWebhookProcessingStatus.PROCESSED,
    });
  });

  it('rejects unsupported webhook provider', async () => {
    const { service } = setup();
    await expect(
      service.processWebhook('UNKNOWN', {}, 'sig'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('allows business members to read business payment visibility only through membership', async () => {
    const { service, prisma, businesses } = setup();
    prisma.payment.findMany.mockResolvedValue([payment()]);
    prisma.payment.count.mockResolvedValue(1);
    const result = await service.findBusiness(travelerId, businessId, {
      page: 1,
      limit: 20,
    });
    expect(result.meta.total).toBe(1);
    expect(businesses.requireMembership).toHaveBeenCalled();
  });

  it('creates full and partial refunds and rejects over-refunds', async () => {
    const { service, tx } = setup();
    tx.payment.findUnique.mockResolvedValue(
      payment({ status: PaymentStatus.PAID, refunds: [] }),
    );
    tx.paymentRefund.create.mockResolvedValue({ id: 'refund-id' });
    tx.paymentRefund.aggregate.mockResolvedValue({
      _sum: { amount: new Prisma.Decimal(50) },
    });
    tx.payment.findUniqueOrThrow.mockResolvedValue(
      payment({ status: PaymentStatus.PARTIALLY_REFUNDED }),
    );
    await expect(
      service.refund(
        paymentId,
        { amount: 50, reason: 'Guest request' },
        undefined,
      ),
    ).resolves.toMatchObject({ status: PaymentStatus.PARTIALLY_REFUNDED });

    tx.payment.findUnique.mockResolvedValue(
      payment({
        status: PaymentStatus.PARTIALLY_REFUNDED,
        refunds: [
          {
            id: 'refund-1',
            amount: new Prisma.Decimal(50),
            currency: 'ETB',
            reason: null,
            status: PaymentRefundStatus.SUCCEEDED,
            idempotencyKey: null,
            createdAt: new Date(),
            completedAt: new Date(),
            paymentId,
            providerRefundId: 'dev_ref_1',
          },
        ],
      }),
    );
    await expect(
      service.refund(paymentId, { amount: 100 }, undefined),
    ).rejects.toThrow('exceeds refundable balance');
  });
});
