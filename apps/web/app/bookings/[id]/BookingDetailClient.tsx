'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import {
  canTravelerCancel,
  formatBookingDate,
  formatBookingRange,
  formatMoney,
} from '../../../lib/bookings';
import type { Booking } from '../../../lib/types';
import {
  BookingStatusBadge,
  PaymentStatusBadge,
} from '../../../components/bookings/BookingStatusBadge';
import { PaymentActionPanel } from '../../../components/payments/PaymentActionPanel';

export function BookingDetailClient() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ id: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBooking = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/bookings/${params.id}`, {
        cache: 'no-store',
      });
      if (response.status === 401) {
        router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
        return;
      }
      if (!response.ok) throw new Error('Request failed');
      setBooking((await response.json()) as Booking);
    } catch {
      setError('We could not load this booking right now.');
    } finally {
      setLoading(false);
    }
  }, [params.id, pathname, router]);

  useEffect(() => {
    void loadBooking();
  }, [loadBooking]);

  async function cancelBooking() {
    if (!booking || !window.confirm('Cancel this booking?')) return;
    setWorking(true);
    setError(null);
    try {
      const response = await fetch(`/api/bookings/${booking.id}/cancel`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: 'Cancelled by traveler' }),
      });
      if (response.status === 401) {
        router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
        return;
      }
      if (response.status === 409) {
        setError('This booking can no longer be cancelled.');
        return;
      }
      if (!response.ok) throw new Error('Request failed');
      setBooking((await response.json()) as Booking);
      router.refresh();
    } catch {
      setError('We could not cancel this booking right now.');
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        Loading booking...
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        {error ?? 'Booking not found.'}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link
        href="/bookings"
        className="inline-flex items-center gap-2 text-sm font-semibold text-highland hover:text-highland/80 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> My Bookings
      </Link>
      {error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          {error}
        </div>
      ) : null}
      <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">
              {booking.reference}
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950">
              {booking.service.name}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {booking.business.name}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <BookingStatusBadge status={booking.bookingStatus} />
            <PaymentStatusBadge status={booking.paymentStatus} />
          </div>
        </div>
        <dl className="mt-6 grid gap-4 text-sm md:grid-cols-2">
          <div>
            <dt className="font-semibold text-slate-700">Date and time</dt>
            <dd className="mt-1 text-slate-600">
              {formatBookingRange(booking)}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-700">Booking mode</dt>
            <dd className="mt-1 text-slate-600">
              {booking.bookingModeSnapshot.replace('_', ' ')}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-700">Quantity</dt>
            <dd className="mt-1 text-slate-600">{booking.quantity}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-700">Unit price</dt>
            <dd className="mt-1 text-slate-600">
              {formatMoney(booking.unitPrice, booking.currency)}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-700">Total</dt>
            <dd className="mt-1 text-slate-600">
              {formatMoney(booking.subtotal, booking.currency)}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-700">Created</dt>
            <dd className="mt-1 text-slate-600">
              {formatBookingDate(booking.createdAt)}
            </dd>
          </div>
        </dl>
        {booking.travelerNote ? (
          <p className="mt-5 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
            {booking.travelerNote}
          </p>
        ) : null}
        {canTravelerCancel(booking.bookingStatus) ? (
          <button
            type="button"
            disabled={working}
            onClick={() => void cancelBooking()}
            className="mt-6 inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {working ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            Cancel booking
          </button>
        ) : null}
      </article>
      <PaymentActionPanel booking={booking} onPaymentChange={loadBooking} />
      {booking.history.length ? (
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">Status history</h2>
          <ol className="mt-4 space-y-3">
            {booking.history.map((item) => (
              <li
                key={item.id}
                className="border-l-2 border-slate-200 pl-4 text-sm"
              >
                <p className="font-semibold text-slate-900">
                  {item.toStatus.replaceAll('_', ' ')}
                </p>
                <p className="text-slate-500">
                  {formatBookingDate(item.createdAt)}
                </p>
                {item.note ? (
                  <p className="mt-1 text-slate-600">{item.note}</p>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
