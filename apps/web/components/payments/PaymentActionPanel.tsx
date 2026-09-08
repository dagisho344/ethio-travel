'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { CreditCard, Loader2 } from 'lucide-react';
import { PaymentStatusBadge } from '../bookings/BookingStatusBadge';
import { PaymentEmptyState, PaymentSummary } from './PaymentSummary';
import { formatMoney } from '../../lib/bookings';
import { isBookingPayable } from '../../lib/payments';
import type {
  Booking,
  PaymentInitiationResponse,
  PaymentListResponse,
} from '../../lib/types';

export function PaymentActionPanel({
  booking,
  onPaymentChange,
}: {
  booking: Booking;
  onPaymentChange: () => void | Promise<void>;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [page, setPage] = useState<PaymentListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const payable = isBookingPayable(booking);

  const latestPayment = useMemo(() => page?.data[0], [page]);
  const paymentInProgress = latestPayment?.status === 'PENDING';
  const canStartPayment = payable && !paymentInProgress;

  const loadPayments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/bookings/${booking.id}/payments?limit=10`,
        {
          cache: 'no-store',
        },
      );
      if (response.status === 401) {
        router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
        return;
      }
      if (!response.ok) throw new Error('Request failed');
      setPage((await response.json()) as PaymentListResponse);
    } catch {
      setPage(null);
      setError('We could not load payment history right now.');
    } finally {
      setLoading(false);
    }
  }, [booking.id, pathname, router]);

  useEffect(() => {
    void loadPayments();
  }, [loadPayments]);

  async function startPayment() {
    if (!canStartPayment || working) return;
    setWorking(true);
    setMessage(null);
    setError(null);
    try {
      const idempotencyKey = crypto.randomUUID();
      const response = await fetch(`/api/bookings/${booking.id}/payments`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': idempotencyKey,
        },
        body: JSON.stringify({ idempotencyKey }),
      });
      if (response.status === 401) {
        router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
        return;
      }
      if (response.status === 409) {
        setMessage(
          'This booking already has an active or settled payment. Refreshing payment history.',
        );
        await loadPayments();
        await onPaymentChange();
        return;
      }
      if (response.status === 403) {
        setError('You do not have access to pay for this booking.');
        return;
      }
      if (response.status === 404) {
        setError('We could not find this booking.');
        return;
      }
      if (!response.ok) throw new Error('Request failed');
      const payment = (await response.json()) as PaymentInitiationResponse;
      setMessage(
        payment.status === 'PENDING'
          ? 'Payment started. Waiting for provider confirmation.'
          : 'Payment state updated from the provider.',
      );
      await loadPayments();
      await onPaymentChange();
      router.refresh();
    } catch {
      setError('We could not start payment right now. Please try again.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">
            Payment
          </p>
          <h2 className="mt-1 text-xl font-bold text-slate-950">
            Booking payment
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Total due: {formatMoney(booking.subtotal, booking.currency)}
          </p>
        </div>
        <PaymentStatusBadge status={booking.paymentStatus} />
      </div>

      {message ? (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {error}
        </div>
      ) : null}

      <div className="mt-5 flex flex-wrap items-center gap-3">
        {canStartPayment ? (
          <button
            type="button"
            disabled={working}
            onClick={() => void startPayment()}
            className="inline-flex items-center gap-2 rounded-md bg-highland px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {working ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <CreditCard className="h-4 w-4" aria-hidden="true" />
            )}
            {working
              ? 'Starting payment...'
              : booking.paymentStatus === 'FAILED'
                ? 'Retry payment'
                : 'Pay now'}
          </button>
        ) : (
          <p className="text-sm text-slate-600">
            {paymentInProgress
              ? 'A payment is already pending for this booking.'
              : 'Payment is not currently available for this booking.'}
          </p>
        )}
      </div>

      <div className="mt-6">
        <h3 className="text-base font-bold text-slate-950">Payment history</h3>
        {loading ? (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
            Loading payment history...
          </div>
        ) : page?.data.length ? (
          <div className="mt-3 space-y-4">
            {page.data.map((payment) => (
              <PaymentSummary key={payment.id} payment={payment} />
            ))}
          </div>
        ) : (
          <div className="mt-3">
            <PaymentEmptyState />
          </div>
        )}
      </div>
    </section>
  );
}
