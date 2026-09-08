import type { Booking, BookingStatus, PaymentStatus } from './types';

export const bookingStatusOptions: Array<{
  value: BookingStatus | '';
  label: string;
}> = [
  { value: '', label: 'All statuses' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'CONFIRMED', label: 'Confirmed' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'CANCELLED_BY_TRAVELER', label: 'Cancelled by traveler' },
  { value: 'CANCELLED_BY_BUSINESS', label: 'Cancelled by business' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'NO_SHOW', label: 'No-show' },
];

const bookingStatusLabels: Record<BookingStatus, string> = {
  PENDING: 'Pending',
  CONFIRMED: 'Confirmed',
  REJECTED: 'Rejected',
  CANCELLED_BY_TRAVELER: 'Cancelled by traveler',
  CANCELLED_BY_BUSINESS: 'Cancelled by business',
  COMPLETED: 'Completed',
  NO_SHOW: 'No-show',
};

const paymentStatusLabels: Record<PaymentStatus, string> = {
  NOT_REQUIRED: 'Payment not required',
  UNPAID: 'Unpaid',
  PENDING: 'Payment pending',
  PAID: 'Paid',
  PARTIALLY_REFUNDED: 'Partially refunded',
  REFUNDED: 'Refunded',
  FAILED: 'Payment failed',
};

export function bookingStatusLabel(status: BookingStatus): string {
  return bookingStatusLabels[status];
}

export function paymentStatusLabel(status: PaymentStatus): string {
  return paymentStatusLabels[status];
}

export function canTravelerCancel(status: BookingStatus): boolean {
  return status === 'PENDING' || status === 'CONFIRMED';
}

export function businessActions(status: BookingStatus) {
  if (status === 'PENDING') return ['confirm', 'reject', 'cancel'] as const;
  if (status === 'CONFIRMED') return ['cancel', 'complete', 'no-show'] as const;
  return [] as const;
}

export function formatBookingDate(value: string): string {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function formatBookingRange(
  booking: Pick<Booking, 'startAt' | 'endAt'>,
) {
  return `${formatBookingDate(booking.startAt)} to ${formatBookingDate(booking.endAt)}`;
}

export function formatMoney(
  amount: string | number | null | undefined,
  currency: string | null | undefined,
): string {
  if (amount === null || amount === undefined) return 'No charge';
  const value = Number(amount);
  if (!Number.isFinite(value)) return `${amount} ${currency ?? ''}`.trim();
  if (!currency) return value.toLocaleString('en');
  return `${currency} ${value.toLocaleString('en', {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function safeReturnTo(pathname: string, search = ''): string {
  const value = `${pathname}${search}`;
  if (!value.startsWith('/') || value.startsWith('//')) return '/services';
  if (value.startsWith('/login') || value.startsWith('/register'))
    return '/services';
  return value;
}
