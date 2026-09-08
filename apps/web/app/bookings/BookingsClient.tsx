'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, CalendarClock } from 'lucide-react';
import {
  bookingStatusOptions,
  formatBookingRange,
  formatMoney,
} from '../../lib/bookings';
import type {
  Booking,
  BookingListResponse,
  BookingStatus,
} from '../../lib/types';
import {
  BookingStatusBadge,
  PaymentStatusBadge,
} from '../../components/bookings/BookingStatusBadge';

export function BookingsClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [page, setPage] = useState<BookingListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const status = searchParams.get('status') as BookingStatus | null;
  const currentPage = searchParams.get('page') ?? '1';

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: currentPage, limit: '9' });
    if (status) params.set('status', status);
    return params.toString();
  }, [currentPage, status]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/bookings?${query}`, {
          cache: 'no-store',
        });
        if (response.status === 401) {
          router.replace(
            `/login?returnTo=${encodeURIComponent(`${pathname}?${query}`)}`,
          );
          return;
        }
        if (!response.ok) throw new Error('Request failed');
        setPage((await response.json()) as BookingListResponse);
      } catch {
        setPage(null);
        setError('We could not load your bookings right now.');
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [pathname, query, router]);

  function update(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    const url = params.toString() ? `${pathname}?${params}` : pathname;
    router.push(url);
  }

  return (
    <div>
      <div className="mb-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <label className="text-sm font-semibold text-slate-700">
          Booking status
          <select
            value={status ?? ''}
            onChange={(event) =>
              update({ status: event.target.value || null, page: null })
            }
            className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none focus:border-highland focus:ring-2 focus:ring-highland/20 sm:w-72"
          >
            {bookingStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          {error}
        </div>
      ) : null}
      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Loading bookings...
        </div>
      ) : page?.data.length ? (
        <>
          <div className="mb-4 flex items-center justify-between gap-4 text-sm text-slate-600">
            <p>
              {page.meta.total} booking{page.meta.total === 1 ? '' : 's'}
            </p>
            <p>
              Page {page.meta.page} of {Math.max(page.meta.totalPages, 1)}
            </p>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            {page.data.map((booking) => (
              <BookingCard key={booking.id} booking={booking} />
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-highland">
            <CalendarClock className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-slate-950">
            No bookings yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
            Your requested trips and services will appear here.
          </p>
          <Link
            href="/services"
            className="mt-5 inline-flex rounded-md bg-highland px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
          >
            Browse services
          </Link>
        </div>
      )}

      {page && page.meta.totalPages > 1 ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={page.meta.page <= 1}
            onClick={() => update({ page: String(page.meta.page - 1) })}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page.meta.page >= page.meta.totalPages}
            onClick={() => update({ page: String(page.meta.page + 1) })}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}

function BookingCard({ booking }: { booking: Booking }) {
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">
            {booking.reference}
          </p>
          <h2 className="mt-1 text-lg font-bold text-slate-950">
            {booking.service.name}
          </h2>
          <p className="mt-1 text-sm text-slate-600">{booking.business.name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <BookingStatusBadge status={booking.bookingStatus} />
          <PaymentStatusBadge status={booking.paymentStatus} />
        </div>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-slate-700">When</dt>
          <dd className="mt-1 text-slate-600">{formatBookingRange(booking)}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-700">Quantity</dt>
          <dd className="mt-1 text-slate-600">{booking.quantity}</dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-700">Total</dt>
          <dd className="mt-1 text-slate-600">
            {formatMoney(booking.subtotal, booking.currency)}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-700">Mode</dt>
          <dd className="mt-1 text-slate-600">
            {booking.bookingModeSnapshot.replace('_', ' ')}
          </dd>
        </div>
      </dl>
      <Link
        href={`/bookings/${booking.id}`}
        className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-highland hover:text-highland/80 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
      >
        View details <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </article>
  );
}
