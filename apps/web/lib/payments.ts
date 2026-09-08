import type {
  Booking,
  Payment,
  PaymentProvider,
  PaymentRefundStatus,
  PaymentStatus,
  PaymentTransactionStatus,
  PaymentTransactionType,
} from './types';

export const paymentStatusOptions: Array<{
  value: PaymentStatus | '';
  label: string;
}> = [
  { value: '', label: 'All payment statuses' },
  { value: 'PENDING', label: 'Payment pending' },
  { value: 'PAID', label: 'Paid' },
  { value: 'PARTIALLY_REFUNDED', label: 'Partially refunded' },
  { value: 'REFUNDED', label: 'Refunded' },
  { value: 'FAILED', label: 'Payment failed' },
];

export const paymentProviderOptions: Array<{
  value: PaymentProvider | '';
  label: string;
}> = [
  { value: '', label: 'All providers' },
  { value: 'DEVELOPMENT', label: 'Development provider' },
  { value: 'STRIPE', label: 'Stripe' },
];

const providerLabels: Record<PaymentProvider, string> = {
  DEVELOPMENT: 'Development provider',
  STRIPE: 'Stripe',
};

const transactionTypeLabels: Record<PaymentTransactionType, string> = {
  PAYMENT_INITIATED: 'Payment initiated',
  PROVIDER_AUTHORIZATION: 'Provider authorization',
  PAYMENT_CAPTURED: 'Payment captured',
  PAYMENT_FAILED: 'Payment failed',
  REFUND_INITIATED: 'Refund initiated',
  REFUND_SUCCEEDED: 'Refund succeeded',
  REFUND_FAILED: 'Refund failed',
};

const transactionStatusLabels: Record<PaymentTransactionStatus, string> = {
  PENDING: 'Pending',
  SUCCEEDED: 'Succeeded',
  FAILED: 'Failed',
};

const refundStatusLabels: Record<PaymentRefundStatus, string> = {
  PENDING: 'Pending',
  SUCCEEDED: 'Succeeded',
  FAILED: 'Failed',
};

export function paymentProviderLabel(provider: PaymentProvider): string {
  return providerLabels[provider];
}

export function paymentTransactionTypeLabel(
  type: PaymentTransactionType,
): string {
  return transactionTypeLabels[type];
}

export function paymentTransactionStatusLabel(
  status: PaymentTransactionStatus,
): string {
  return transactionStatusLabels[status];
}

export function paymentRefundStatusLabel(status: PaymentRefundStatus): string {
  return refundStatusLabels[status];
}

export function formatPaymentDate(value: string | null | undefined): string {
  if (!value) return 'Not recorded';
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function isBookingPayable(booking: Booking): boolean {
  const total = Number(booking.subtotal);
  return (
    ['PENDING', 'CONFIRMED'].includes(booking.bookingStatus) &&
    ['UNPAID', 'FAILED'].includes(booking.paymentStatus) &&
    Number.isFinite(total) &&
    total > 0 &&
    Boolean(booking.currency)
  );
}

export function refundedAmount(payment: Payment): number {
  return payment.refunds
    .filter((refund) => refund.status === 'SUCCEEDED')
    .reduce((sum, refund) => sum + Number(refund.amount), 0);
}

export function refundableBalance(payment: Payment): number {
  const remaining = Number(payment.amount) - refundedAmount(payment);
  return Math.max(0, Number.isFinite(remaining) ? remaining : 0);
}

export function canAdminRefund(payment: Payment): boolean {
  return (
    ['PAID', 'PARTIALLY_REFUNDED'].includes(payment.status) &&
    refundableBalance(payment) > 0
  );
}
