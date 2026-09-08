import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentProvider, PaymentStatus } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  PaymentGateway,
  ProviderPaymentInput,
  ProviderPaymentResult,
  ProviderRefundInput,
  ProviderRefundResult,
  ProviderWebhookResult,
} from '../payment-gateway';

type DevelopmentWebhookPayload = {
  eventId: string;
  eventType: string;
  paymentId: string;
  providerPaymentId?: string;
  status: 'PAID' | 'FAILED';
};

@Injectable()
export class DevelopmentPaymentGateway implements PaymentGateway {
  readonly provider = PaymentProvider.DEVELOPMENT;

  constructor(private readonly config: ConfigService) {}

  createPayment(input: ProviderPaymentInput): Promise<ProviderPaymentResult> {
    const providerPaymentId = `dev_pay_${input.paymentId}`;
    return Promise.resolve({
      provider: this.provider,
      providerPaymentId,
      status: PaymentStatus.PENDING,
      safeResponse: {
        provider: this.provider,
        paymentReference: providerPaymentId,
      },
    });
  }

  verifyWebhook(
    payload: unknown,
    signature: string | undefined,
  ): Promise<ProviderWebhookResult> {
    if (!signature || !this.signatureMatches(payload, signature)) {
      throw new UnauthorizedException('Invalid payment webhook signature.');
    }
    if (!this.isWebhookPayload(payload)) {
      throw new UnauthorizedException('Invalid payment webhook payload.');
    }
    return Promise.resolve({
      provider: this.provider,
      providerEventId: payload.eventId,
      eventType: payload.eventType,
      paymentId: payload.paymentId,
      providerPaymentId: payload.providerPaymentId,
      status:
        payload.status === 'PAID' ? PaymentStatus.PAID : PaymentStatus.FAILED,
    });
  }

  refundPayment(input: ProviderRefundInput): Promise<ProviderRefundResult> {
    return Promise.resolve({
      providerRefundId: `dev_ref_${input.paymentId}_${input.idempotencyKey ?? Date.now().toString(36)}`,
      succeeded: true,
    });
  }

  private signatureMatches(payload: unknown, signature: string): boolean {
    const secret = this.config.get<string>('paymentDevelopmentWebhookSecret');
    if (!secret) return false;
    const expected = createHmac('sha256', secret)
      .update(JSON.stringify(payload))
      .digest('hex');
    const normalized = signature.startsWith('sha256=')
      ? signature.slice('sha256='.length)
      : signature;
    const actual = Buffer.from(normalized, 'hex');
    const expectedBuffer = Buffer.from(expected, 'hex');
    return (
      actual.length === expectedBuffer.length &&
      timingSafeEqual(actual, expectedBuffer)
    );
  }

  private isWebhookPayload(
    payload: unknown,
  ): payload is DevelopmentWebhookPayload {
    if (!payload || typeof payload !== 'object') return false;
    const value = payload as Record<string, unknown>;
    return (
      typeof value.eventId === 'string' &&
      typeof value.eventType === 'string' &&
      typeof value.paymentId === 'string' &&
      (value.providerPaymentId === undefined ||
        typeof value.providerPaymentId === 'string') &&
      (value.status === 'PAID' || value.status === 'FAILED')
    );
  }
}
