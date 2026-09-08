import { PaymentProvider, PaymentStatus } from '@prisma/client';

export interface ProviderPaymentInput {
  paymentId: string;
  bookingId: string;
  amount: string;
  currency: string;
  idempotencyKey?: string;
}

export interface ProviderPaymentResult {
  provider: PaymentProvider;
  providerPaymentId: string;
  status: PaymentStatus;
  safeResponse: Record<string, string>;
}

export interface ProviderWebhookResult {
  provider: PaymentProvider;
  providerEventId: string;
  eventType: string;
  paymentId: string;
  providerPaymentId?: string;
  status: PaymentStatus;
}

export interface ProviderRefundInput {
  paymentId: string;
  amount: string;
  currency: string;
  idempotencyKey?: string;
}

export interface ProviderRefundResult {
  providerRefundId: string;
  succeeded: boolean;
}

export interface PaymentGateway {
  readonly provider: PaymentProvider;
  createPayment(input: ProviderPaymentInput): Promise<ProviderPaymentResult>;
  verifyWebhook(
    payload: unknown,
    signature: string | undefined,
  ): Promise<ProviderWebhookResult>;
  refundPayment(input: ProviderRefundInput): Promise<ProviderRefundResult>;
}

export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
