import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BookingStatus,
  BusinessMemberRole,
  PaymentProvider,
  PaymentRefundStatus,
  PaymentStatus,
  PaymentTransactionStatus,
  PaymentTransactionType,
  PaymentWebhookProcessingStatus,
  Prisma,
  UserStatus,
  NotificationType,
} from '@prisma/client';
import { BusinessesService } from '../businesses/businesses.service';
import { paginate, PaginatedResponse } from '../common/dto/pagination.dto';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreatePaymentDto,
  PaymentQueryDto,
  RefundPaymentDto,
} from './dto/payment.dto';
import { PAYMENT_GATEWAY, PaymentGateway } from './payment-gateway';

const paymentSelect = Prisma.validator<Prisma.PaymentSelect>()({
  id: true,
  bookingId: true,
  travelerId: true,
  businessId: true,
  provider: true,
  providerPaymentId: true,
  amount: true,
  currency: true,
  status: true,
  method: true,
  paidAt: true,
  failedAt: true,
  createdAt: true,
  updatedAt: true,
  booking: {
    select: {
      id: true,
      reference: true,
      bookingStatus: true,
      paymentStatus: true,
      service: { select: { id: true, name: true, slug: true } },
      business: { select: { id: true, name: true, slug: true } },
    },
  },
  transactions: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      type: true,
      amount: true,
      currency: true,
      status: true,
      createdAt: true,
    },
  },
  refunds: {
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      amount: true,
      currency: true,
      reason: true,
      status: true,
      createdAt: true,
      completedAt: true,
    },
  },
});

type PaymentRecord = Prisma.PaymentGetPayload<{ select: typeof paymentSelect }>;
type ProviderWebhook = {
  provider: PaymentProvider;
  providerEventId: string;
  eventType: string;
  paymentId: string;
  providerPaymentId?: string;
  status: PaymentStatus;
};

const managerRoles = [BusinessMemberRole.OWNER, BusinessMemberRole.MANAGER];
const readerRoles = [...managerRoles, BusinessMemberRole.STAFF];
const payableBookingStatuses: BookingStatus[] = [
  BookingStatus.PENDING,
  BookingStatus.CONFIRMED,
];
const activePaymentStatuses: PaymentStatus[] = [
  PaymentStatus.PENDING,
  PaymentStatus.PAID,
  PaymentStatus.PARTIALLY_REFUNDED,
];
const refundablePaymentStatuses: PaymentStatus[] = [
  PaymentStatus.PAID,
  PaymentStatus.PARTIALLY_REFUNDED,
];
const settledPaymentStatuses: PaymentStatus[] = [
  PaymentStatus.PAID,
  PaymentStatus.PARTIALLY_REFUNDED,
  PaymentStatus.REFUNDED,
];

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly businesses: BusinessesService,
    private readonly config: ConfigService,
    @Inject(PAYMENT_GATEWAY) private readonly gateway: PaymentGateway,
    private readonly notifications?: NotificationsService,
  ) {}

  async createForBooking(
    userId: string,
    bookingId: string,
    dto: CreatePaymentDto,
    headerIdempotencyKey?: string,
  ): Promise<PaymentRecord & { providerResponse?: Record<string, string> }> {
    await this.ensureActiveUser(userId);
    const idempotencyKey = this.normalizeIdempotencyKey(
      headerIdempotencyKey ?? dto.idempotencyKey,
    );

    let providerInput:
      | {
          paymentId: string;
          amount: string;
          currency: string;
          bookingId: string;
        }
      | undefined;

    const payment = await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${bookingId}))`;
        const booking = await tx.booking.findFirst({
          where: { id: bookingId, travelerId: userId },
          select: {
            id: true,
            businessId: true,
            travelerId: true,
            bookingStatus: true,
            paymentStatus: true,
            subtotal: true,
            currency: true,
          },
        });
        if (!booking) throw new NotFoundException('Booking not found.');
        this.assertPayableBooking(booking);

        if (idempotencyKey) {
          const existingByKey = await tx.payment.findFirst({
            where: { bookingId, idempotencyKey },
            select: paymentSelect,
          });
          if (existingByKey) return existingByKey;
        }

        const existingActive = await tx.payment.findFirst({
          where: { bookingId, status: { in: activePaymentStatuses } },
          select: paymentSelect,
          orderBy: { createdAt: 'desc' },
        });
        if (existingActive) {
          if (existingActive.status === PaymentStatus.PENDING) {
            return existingActive;
          }
          throw new ConflictException('Booking payment is already settled.');
        }

        const created = await tx.payment.create({
          data: {
            bookingId,
            travelerId: userId,
            businessId: booking.businessId,
            provider: this.provider(),
            amount: booking.subtotal,
            currency: booking.currency ?? '',
            status: PaymentStatus.PENDING,
            idempotencyKey,
            transactions: {
              create: {
                type: PaymentTransactionType.PAYMENT_INITIATED,
                amount: booking.subtotal,
                currency: booking.currency ?? '',
                status: PaymentTransactionStatus.SUCCEEDED,
              },
            },
          },
          select: paymentSelect,
        });
        await tx.booking.update({
          where: { id: bookingId },
          data: { paymentStatus: PaymentStatus.PENDING },
        });
        providerInput = {
          paymentId: created.id,
          amount: created.amount.toString(),
          currency: created.currency,
          bookingId,
        };
        return created;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (!providerInput || payment.providerPaymentId) return payment;

    const providerResult = await this.gateway.createPayment({
      ...providerInput,
      idempotencyKey,
    });
    const updated = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.payment.update({
        where: { id: payment.id },
        data: {
          providerPaymentId: providerResult.providerPaymentId,
          status: providerResult.status,
          failedAt: providerResult.status === PaymentStatus.FAILED ? now : null,
        },
      });
      await tx.paymentTransaction.create({
        data: {
          paymentId: payment.id,
          type:
            providerResult.status === PaymentStatus.FAILED
              ? PaymentTransactionType.PAYMENT_FAILED
              : PaymentTransactionType.PROVIDER_AUTHORIZATION,
          providerTransactionId: `${providerResult.providerPaymentId}_init`,
          amount: payment.amount,
          currency: payment.currency,
          status:
            providerResult.status === PaymentStatus.FAILED
              ? PaymentTransactionStatus.FAILED
              : PaymentTransactionStatus.SUCCEEDED,
        },
      });
      if (providerResult.status === PaymentStatus.FAILED) {
        await tx.booking.update({
          where: { id: payment.bookingId },
          data: { paymentStatus: PaymentStatus.FAILED },
        });
      }
      return tx.payment.findUniqueOrThrow({
        where: { id: payment.id },
        select: paymentSelect,
      });
    });
    if (updated.status === PaymentStatus.FAILED) {
      await this.notifyPayment(
        updated,
        NotificationType.PAYMENT_FAILED,
        'payment-failed:' + updated.id,
      );
    }
    return { ...updated, providerResponse: providerResult.safeResponse };
  }

  async findForBooking(
    userId: string,
    bookingId: string,
    query: PaymentQueryDto,
  ): Promise<PaginatedResponse<PaymentRecord>> {
    await this.ensureBookingOwner(userId, bookingId);
    return this.paginated({ ...this.queryWhere(query), bookingId }, query);
  }

  async findMineById(userId: string, id: string): Promise<PaymentRecord> {
    await this.ensureActiveUser(userId);
    const payment = await this.prisma.payment.findFirst({
      where: { id, travelerId: userId },
      select: paymentSelect,
    });
    if (!payment) throw new NotFoundException('Payment not found.');
    return payment;
  }

  async findBusiness(
    userId: string,
    businessId: string,
    query: PaymentQueryDto,
  ): Promise<PaginatedResponse<PaymentRecord>> {
    await this.businesses.requireMembership(userId, businessId, readerRoles);
    return this.paginated({ ...this.queryWhere(query), businessId }, query);
  }

  async findBusinessById(
    userId: string,
    businessId: string,
    paymentId: string,
  ): Promise<PaymentRecord> {
    await this.businesses.requireMembership(userId, businessId, readerRoles);
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId, businessId },
      select: paymentSelect,
    });
    if (!payment) throw new NotFoundException('Payment not found.');
    return payment;
  }

  async findAdmin(
    query: PaymentQueryDto,
  ): Promise<PaginatedResponse<PaymentRecord>> {
    return this.paginated(this.queryWhere(query), query);
  }

  async findAdminById(id: string): Promise<PaymentRecord> {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      select: paymentSelect,
    });
    if (!payment) throw new NotFoundException('Payment not found.');
    return payment;
  }

  async processWebhook(
    providerValue: string,
    payload: unknown,
    signature?: string,
  ) {
    const provider = this.parseProvider(providerValue);
    if (provider !== this.gateway.provider) {
      throw new BadRequestException('Payment provider is not configured.');
    }
    const verified = await this.gateway.verifyWebhook(payload, signature);
    return this.processVerifiedWebhook(verified, payload);
  }

  async refund(
    paymentId: string,
    dto: RefundPaymentDto,
    headerIdempotencyKey?: string,
  ): Promise<PaymentRecord> {
    const idempotencyKey = this.normalizeIdempotencyKey(
      headerIdempotencyKey ?? dto.idempotencyKey,
    );
    const amount = new Prisma.Decimal(dto.amount.toFixed(2));
    let refundId: string | undefined;
    let paymentSnapshot:
      { id: string; amount: Prisma.Decimal; currency: string } | undefined;

    const existing = await this.prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${paymentId}))`;
        const payment = await tx.payment.findUnique({
          where: { id: paymentId },
          include: { refunds: true },
        });
        if (!payment) throw new NotFoundException('Payment not found.');
        if (idempotencyKey) {
          const existingByKey = payment.refunds.find(
            (refund) => refund.idempotencyKey === idempotencyKey,
          );
          if (existingByKey) return payment.id;
        }
        if (!refundablePaymentStatuses.includes(payment.status)) {
          throw new ConflictException('Payment is not refundable.');
        }
        const refunded = payment.refunds
          .filter((refund) => refund.status === PaymentRefundStatus.SUCCEEDED)
          .reduce(
            (sum, refund) => sum.add(refund.amount),
            new Prisma.Decimal(0),
          );
        const remaining = payment.amount.sub(refunded);
        if (amount.gt(remaining)) {
          throw new ConflictException(
            'Refund amount exceeds refundable balance.',
          );
        }
        const created = await tx.paymentRefund.create({
          data: {
            paymentId,
            amount,
            currency: payment.currency,
            reason: this.trim(dto.reason),
            status: PaymentRefundStatus.PENDING,
            idempotencyKey,
          },
        });
        await tx.paymentTransaction.create({
          data: {
            paymentId,
            type: PaymentTransactionType.REFUND_INITIATED,
            amount,
            currency: payment.currency,
            status: PaymentTransactionStatus.SUCCEEDED,
          },
        });
        refundId = created.id;
        paymentSnapshot = {
          id: payment.id,
          amount: payment.amount,
          currency: payment.currency,
        };
        return undefined;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    if (existing) return this.findAdminById(existing);
    if (!refundId || !paymentSnapshot) {
      throw new ConflictException('Refund could not be created.');
    }

    const snapshot = paymentSnapshot;
    const providerRefund = await this.gateway.refundPayment({
      paymentId,
      amount: amount.toString(),
      currency: snapshot.currency,
      idempotencyKey,
    });

    const updated = await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      await tx.paymentRefund.update({
        where: { id: refundId },
        data: {
          providerRefundId: providerRefund.providerRefundId,
          status: providerRefund.succeeded
            ? PaymentRefundStatus.SUCCEEDED
            : PaymentRefundStatus.FAILED,
          completedAt: providerRefund.succeeded ? now : undefined,
        },
      });
      await tx.paymentTransaction.create({
        data: {
          paymentId,
          type: providerRefund.succeeded
            ? PaymentTransactionType.REFUND_SUCCEEDED
            : PaymentTransactionType.REFUND_FAILED,
          providerTransactionId: providerRefund.providerRefundId,
          amount,
          currency: snapshot.currency,
          status: providerRefund.succeeded
            ? PaymentTransactionStatus.SUCCEEDED
            : PaymentTransactionStatus.FAILED,
        },
      });
      if (providerRefund.succeeded) {
        const aggregate = await tx.paymentRefund.aggregate({
          where: { paymentId, status: PaymentRefundStatus.SUCCEEDED },
          _sum: { amount: true },
        });
        const refunded = aggregate._sum.amount ?? new Prisma.Decimal(0);
        const status = refunded.gte(snapshot.amount)
          ? PaymentStatus.REFUNDED
          : PaymentStatus.PARTIALLY_REFUNDED;
        await tx.payment.update({
          where: { id: paymentId },
          data: { status },
        });
        await tx.booking.updateMany({
          where: { payments: { some: { id: paymentId } } },
          data: { paymentStatus: status },
        });
      }
      return tx.payment.findUniqueOrThrow({
        where: { id: paymentId },
        select: paymentSelect,
      });
    });
    if (providerRefund.succeeded) {
      await this.notifyPayment(
        updated,
        NotificationType.PAYMENT_REFUNDED,
        'payment-refunded:' + refundId,
      );
    }
    return updated;
  }
  private async processVerifiedWebhook(
    event: ProviderWebhook,
    payload: unknown,
  ) {
    const webhook = await this.recordWebhook(event, payload);
    if (webhook.processingStatus !== PaymentWebhookProcessingStatus.RECEIVED) {
      return {
        received: true,
        duplicate: true,
        status: webhook.processingStatus,
      };
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findFirst({
        where: {
          id: event.paymentId,
          provider: event.provider,
          providerPaymentId: event.providerPaymentId ?? undefined,
        },
      });
      if (!payment) {
        await tx.paymentWebhookEvent.update({
          where: { id: webhook.id },
          data: {
            processingStatus: PaymentWebhookProcessingStatus.FAILED,
            processedAt: new Date(),
            failureReason: 'Payment not found.',
          },
        });
        throw new NotFoundException('Payment not found.');
      }

      const now = new Date();
      const update = await tx.payment.updateMany({
        where: { id: payment.id, status: PaymentStatus.PENDING },
        data: {
          status: event.status,
          paidAt: event.status === PaymentStatus.PAID ? now : undefined,
          failedAt: event.status === PaymentStatus.FAILED ? now : undefined,
        },
      });

      if (update.count === 1) {
        await tx.booking.update({
          where: { id: payment.bookingId },
          data: { paymentStatus: event.status },
        });
        await tx.paymentTransaction.create({
          data: {
            paymentId: payment.id,
            type:
              event.status === PaymentStatus.PAID
                ? PaymentTransactionType.PAYMENT_CAPTURED
                : PaymentTransactionType.PAYMENT_FAILED,
            providerTransactionId: event.providerEventId,
            amount: payment.amount,
            currency: payment.currency,
            status:
              event.status === PaymentStatus.PAID
                ? PaymentTransactionStatus.SUCCEEDED
                : PaymentTransactionStatus.FAILED,
          },
        });
      }

      await tx.paymentWebhookEvent.update({
        where: { id: webhook.id },
        data: {
          processingStatus:
            update.count === 1
              ? PaymentWebhookProcessingStatus.PROCESSED
              : PaymentWebhookProcessingStatus.IGNORED,
          processedAt: now,
        },
      });
      return {
        received: true,
        duplicate: false,
        processed: update.count === 1,
        payment: update.count === 1 ? payment : undefined,
      };
    });
    if (result.processed && result.payment) {
      const type =
        event.status === PaymentStatus.PAID
          ? NotificationType.PAYMENT_SUCCEEDED
          : NotificationType.PAYMENT_FAILED;
      await this.notifyPayment(
        result.payment,
        type,
        'payment-webhook:' + event.provider + ':' + event.providerEventId,
      );
    }
    return {
      received: result.received,
      duplicate: result.duplicate,
      processed: result.processed,
    };
  }

  private async notifyPayment(
    payment: Pick<PaymentRecord, 'id' | 'travelerId' | 'bookingId'>,
    type: NotificationType,
    dedupeKey: string,
  ): Promise<void> {
    const label =
      type === NotificationType.PAYMENT_SUCCEEDED
        ? 'Payment succeeded'
        : type === NotificationType.PAYMENT_REFUNDED
          ? 'Refund completed'
          : 'Payment failed';
    await this.notifications?.create({
      recipientUserId: payment.travelerId,
      type,
      title: label,
      body: label + ' for your booking.',
      actionUrl: '/bookings/' + payment.bookingId,
      dedupeKey,
    });
  }
  private async recordWebhook(event: ProviderWebhook, payload: unknown) {
    try {
      return await this.prisma.paymentWebhookEvent.create({
        data: {
          provider: event.provider,
          providerEventId: event.providerEventId,
          eventType: event.eventType,
          payload: this.jsonPayload(payload),
        },
      });
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        return this.prisma.paymentWebhookEvent.findUniqueOrThrow({
          where: {
            provider_providerEventId: {
              provider: event.provider,
              providerEventId: event.providerEventId,
            },
          },
        });
      }
      throw error;
    }
  }

  private async paginated(
    where: Prisma.PaymentWhereInput,
    query: PaymentQueryDto,
  ): Promise<PaginatedResponse<PaymentRecord>> {
    const [data, total] = await this.prisma.$transaction([
      this.prisma.payment.findMany({
        where,
        select: paymentSelect,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return paginate(data, total, query.page, query.limit);
  }

  private queryWhere(query: PaymentQueryDto): Prisma.PaymentWhereInput {
    return {
      status: query.status,
      provider: query.provider,
      bookingId: query.bookingId,
      createdAt:
        query.from || query.to
          ? {
              gte: query.from ? new Date(query.from) : undefined,
              lte: query.to ? new Date(query.to) : undefined,
            }
          : undefined,
    };
  }

  private assertPayableBooking(booking: {
    bookingStatus: BookingStatus;
    paymentStatus: PaymentStatus;
    subtotal: Prisma.Decimal;
    currency: string | null;
  }): void {
    if (!payableBookingStatuses.includes(booking.bookingStatus)) {
      throw new ConflictException(
        'Booking is not payable in its current state.',
      );
    }
    if (booking.paymentStatus === PaymentStatus.NOT_REQUIRED) {
      throw new ConflictException('Payment is not required for this booking.');
    }
    if (settledPaymentStatuses.includes(booking.paymentStatus)) {
      throw new ConflictException('Booking payment is already settled.');
    }
    if (booking.subtotal.lte(0) || !booking.currency?.match(/^[A-Z]{3}$/)) {
      throw new ConflictException('Booking payment snapshot is incomplete.');
    }
  }

  private async ensureBookingOwner(
    userId: string,
    bookingId: string,
  ): Promise<void> {
    await this.ensureActiveUser(userId);
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, travelerId: userId },
      select: { id: true },
    });
    if (!booking) throw new NotFoundException('Booking not found.');
  }

  private async ensureActiveUser(userId: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: UserStatus.ACTIVE },
      select: { id: true },
    });
    if (!user) throw new UnauthorizedException('Authentication required.');
  }

  private provider(): PaymentProvider {
    const provider = this.config.get<PaymentProvider>('paymentProvider');
    return provider ?? PaymentProvider.DEVELOPMENT;
  }

  private parseProvider(value: string): PaymentProvider {
    if (Object.values(PaymentProvider).includes(value as PaymentProvider)) {
      return value as PaymentProvider;
    }
    throw new BadRequestException('Unsupported payment provider.');
  }

  private normalizeIdempotencyKey(value?: string): string | undefined {
    const key = this.trim(value);
    if (!key) return undefined;
    if (!/^[A-Za-z0-9._:-]{8,160}$/.test(key)) {
      throw new BadRequestException('Invalid Idempotency-Key header.');
    }
    return key;
  }

  private jsonPayload(payload: unknown): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue;
  }

  private trim(value?: string): string | undefined {
    const trimmed = value?.trim();
    return trimmed || undefined;
  }

  private isUniqueConflict(
    error: unknown,
  ): error is Prisma.PrismaClientKnownRequestError {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
