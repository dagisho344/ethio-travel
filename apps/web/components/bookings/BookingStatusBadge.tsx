import type { BookingStatus, PaymentStatus } from '../../lib/types';
import { useTranslations } from 'next-intl';

const bookingTone: Record<BookingStatus, string> = {
  PENDING: 'border-amber-200 bg-amber-50 text-amber-900',
  CONFIRMED: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  REJECTED: 'border-red-200 bg-red-50 text-red-800',
  CANCELLED_BY_TRAVELER: 'border-slate-200 bg-slate-100 text-slate-700',
  CANCELLED_BY_BUSINESS: 'border-slate-200 bg-slate-100 text-slate-700',
  COMPLETED: 'border-sky-200 bg-sky-50 text-sky-900',
  NO_SHOW: 'border-orange-200 bg-orange-50 text-orange-900',
};

const paymentTone: Record<PaymentStatus, string> = {
  NOT_REQUIRED: 'border-slate-200 bg-slate-100 text-slate-700',
  UNPAID: 'border-amber-200 bg-amber-50 text-amber-900',
  PENDING: 'border-amber-200 bg-amber-50 text-amber-900',
  PAID: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  PARTIALLY_REFUNDED: 'border-sky-200 bg-sky-50 text-sky-900',
  REFUNDED: 'border-slate-200 bg-slate-100 text-slate-700',
  FAILED: 'border-red-200 bg-red-50 text-red-800',
};

const bookingStatusKey = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  REJECTED: 'rejected',
  CANCELLED_BY_TRAVELER: 'cancelledByTraveler',
  CANCELLED_BY_BUSINESS: 'cancelledByBusiness',
  COMPLETED: 'completed',
  NO_SHOW: 'noShow',
} as const;

const paymentStatusKey = {
  NOT_REQUIRED: 'notRequired',
  UNPAID: 'unpaid',
  PENDING: 'pending',
  PAID: 'paidStatus',
  PARTIALLY_REFUNDED: 'partiallyRefunded',
  REFUNDED: 'refundedStatus',
  FAILED: 'failed',
} as const;

function badgeClass(tone: string) {
  return `inline-flex items-center rounded-md border px-2 py-1 text-xs font-semibold ${tone}`;
}

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const t = useTranslations('bookings');
  return (
    <span className={badgeClass(bookingTone[status])}>
      {t(bookingStatusKey[status])}
    </span>
  );
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  const t = useTranslations('payment');
  return (
    <span className={badgeClass(paymentTone[status])}>
      {t(paymentStatusKey[status])}
    </span>
  );
}
