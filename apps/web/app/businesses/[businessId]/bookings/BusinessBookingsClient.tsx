'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from 'next/navigation';
import { Briefcase, Loader2 } from 'lucide-react';
import {
  bookingStatusOptions,
  businessActions,
  formatBookingRange,
  formatMoney,
} from '../../../../lib/bookings';
import type {
  Booking,
  BookingStatus,
  BusinessBookingListResponse,
} from '../../../../lib/types';
import {
  BookingStatusBadge,
  PaymentStatusBadge,
} from '../../../../components/bookings/BookingStatusBadge';

type Action = 'confirm' | 'reject' | 'cancel' | 'complete' | 'no-show';

const actionLabels: Record<Action, string> = {
  confirm: 'Confirm',
  reject: 'Reject',
  cancel: 'Cancel',
  complete: 'Complete',
  'no-show': 'No-show',
};

export function BusinessBookingsClient() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ businessId: string }>();
  const searchParams = useSearchParams();
  const [page, setPage] = useState<BusinessBookingListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const status = searchParams.get('status') as BookingStatus | null;
  const currentPage = searchParams.get('page') ?? '1';

  const query = useMemo(() => {
    const next = new URLSearchParams({ page: currentPage, limit: '10' });
    if (status) next.set('status', status);
    return next.toString();
  }, [currentPage, status]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/businesses/${params.businessId}/bookings?${query}`,
        { cache: 'no-store' },
      );
      if (response.status === 401) {
        router.replace(
          `/login?returnTo=${encodeURIComponent(`${pathname}?${query}`)}`,
        );
        return;
      }
      if (response.status === 403) {
        setError('You do not have access to these business bookings.');
        setPage(null);
        return;
      }
      if (!response.ok) throw new Error('Request failed');
      setPage((await response.json()) as BusinessBookingListResponse);
    } catch {
      setPage(null);
      setError('We could not load business bookings right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [params.businessId, query]);

  function update(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    router.push(next.toString() ? `${pathname}?${next}` : pathname);
  }

  async function action(booking: Booking, name: Action) {
    setWorkingId(`${booking.id}-${name}`);
    setError(null);
    try {
      const response = await fetch(
        `/api/businesses/${params.businessId}/bookings/${booking.id}/${name}`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ note: actionLabels[name] }),
        },
      );
      if (response.status === 401) {
        router.replace(
          `/login?returnTo=${encodeURIComponent(`${pathname}?${query}`)}`,
        );
        return;
      }
      if (response.status === 409) {
        setError('That booking changed state. Refreshing the list.');
        await load();
        return;
      }
      if (response.status === 403) {
        setError('You do not have permission to change this booking.');
        return;
      }
      if (!response.ok) throw new Error('Request failed');
      const updated = (await response.json()) as Booking;
      setPage((current) =>
        current
          ? {
              ...current,
              data: current.data.map((item) =>
                item.id === updated.id ? updated : item,
              ),
            }
          : current,
      );
      router.refresh();
    } catch {
      setError('We could not update this booking right now.');
    } finally {
      setWorkingId(null);
    }
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
          Loading business bookings...
        </div>
      ) : page?.data.length ? (
        <div className="space-y-4">
          {page.data.map((booking) => (
            <article
              key={booking.id}
              className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">
                    {booking.reference}
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-slate-950">
                    {booking.service.name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-600">
                    {formatBookingRange(booking)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <BookingStatusBadge status={booking.bookingStatus} />
                  <PaymentStatusBadge status={booking.paymentStatus} />
                </div>
              </div>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
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
              {businessActions(booking.bookingStatus).length ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {businessActions(booking.bookingStatus).map((name) => (
                    <button
                      key={name}
                      type="button"
                      disabled={Boolean(workingId)}
                      onClick={() => void action(booking, name)}
                      className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-highland hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {workingId === `${booking.id}-${name}` ? (
                        <Loader2
                          className="h-4 w-4 animate-spin"
                          aria-hidden="true"
                        />
                      ) : null}
                      {actionLabels[name]}
                    </button>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-highland">
            <Briefcase className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-slate-950">
            No business bookings yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
            Booking requests for this business will appear here.
          </p>
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
      <Link
        href="/bookings"
        className="mt-8 inline-block text-sm font-semibold text-highland hover:text-highland/80"
      >
        View traveler bookings
      </Link>
    </div>
  );
}
