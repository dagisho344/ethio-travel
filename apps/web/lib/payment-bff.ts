import type { NextRequest } from 'next/server';
import type { PaymentProvider, PaymentStatus } from './types';

const allowedStatuses = new Set<PaymentStatus>([
  'NOT_REQUIRED',
  'UNPAID',
  'PENDING',
  'PAID',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
  'FAILED',
]);

const allowedProviders = new Set<PaymentProvider>(['DEVELOPMENT', 'STRIPE']);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

export function paymentQuery(request: NextRequest): string {
  const source = request.nextUrl.searchParams;
  const query = new URLSearchParams();
  for (const key of ['page', 'limit', 'bookingId', 'from', 'to']) {
    const value = source.get(key);
    if (value) query.set(key, value);
  }
  const status = source.get('status') as PaymentStatus | null;
  if (status && allowedStatuses.has(status)) query.set('status', status);
  const provider = source.get('provider') as PaymentProvider | null;
  if (provider && allowedProviders.has(provider))
    query.set('provider', provider);
  return query.toString();
}

export async function readOptionalJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export function paymentCreateBody(input: unknown): { idempotencyKey?: string } {
  if (!isObject(input)) return {};
  return { idempotencyKey: safeString(input.idempotencyKey) };
}

export function refundCreateBody(input: unknown): {
  amount?: number;
  reason?: string;
  idempotencyKey?: string;
} {
  if (!isObject(input)) return {};
  const numericAmount =
    typeof input.amount === 'number'
      ? input.amount
      : typeof input.amount === 'string'
        ? Number(input.amount)
        : undefined;
  return {
    amount: Number.isFinite(numericAmount) ? numericAmount : undefined,
    reason: safeString(input.reason),
    idempotencyKey: safeString(input.idempotencyKey),
  };
}

export function idempotencyHeader(request: NextRequest): HeadersInit {
  const value = request.headers.get('idempotency-key');
  return value ? { 'idempotency-key': value } : {};
}
