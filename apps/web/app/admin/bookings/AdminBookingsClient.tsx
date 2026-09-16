'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, CalendarSearch } from 'lucide-react';
import {
  BookingStatusBadge,
  PaymentStatusBadge,
} from '../../../components/bookings/BookingStatusBadge';
import {
  bookingStatusOptions,
  formatBookingDate,
  formatMoney,
} from '../../../lib/bookings';
import type { AdminBooking, AdminPage } from '../../../lib/admin';

function travelerName(booking: AdminBooking): string {
  const profile = booking.traveler.profile;
  const name = [profile?.firstName, profile?.lastName]
    .filter(Boolean)
    .join(' ');
  return name || 'Traveler';
}

export function AdminBookingsClient() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [page, setPage] = useState<AdminPage<AdminBooking> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const query = useMemo(() => {
    const next = new URLSearchParams(searchParams);
    if (!next.get('page')) next.set('page', '1');
    if (!next.get('limit')) next.set('limit', '20');
    return next.toString();
  }, [searchParams]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/admin/bookings?' + query, {
          cache: 'no-store',
        });
        if (response.status === 401) {
          router.replace(
            '/login?returnTo=' + encodeURIComponent(pathname + '?' + query),
          );
          return;
        }
        if (response.status === 403) {
          setPage(null);
          setError('Only administrators can inspect bookings.');
          return;
        }
        if (!response.ok) throw new Error('Request failed');
        setPage((await response.json()) as AdminPage<AdminBooking>);
      } catch {
        setPage(null);
        setError('We could not load bookings right now.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [pathname, query, router]);

  function update(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams);
    for (const [key, value] of Object.entries(updates)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    const queryString = next.toString();
    router.push(queryString ? pathname + '?' + queryString : pathname);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
          Operations
        </p>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">
          Booking investigation
        </h1>
        <p className="mt-2 text-slate-600">
          Inspect booking records, schedules, and payment states without
          overriding lifecycle controls.
        </p>
      </header>

      <section
        aria-label="Booking filters"
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4"
      >
        <label className="text-sm font-semibold text-slate-700">
          Booking status
          <select
            value={searchParams.get('status') ?? ''}
            onChange={(event) =>
              update({ status: event.target.value || null, page: null })
            }
            className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {bookingStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Reference
          <input
            value={searchParams.get('reference') ?? ''}
            onChange={(event) =>
              update({
                reference: event.target.value.trim() || null,
                page: null,
              })
            }
            placeholder="ETB-..."
            className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Traveler
          <input
            value={searchParams.get('traveler') ?? ''}
            onChange={(event) =>
              update({
                traveler: event.target.value.trim() || null,
                page: null,
              })
            }
            placeholder="Name or email"
            className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Business
          <input
            value={searchParams.get('business') ?? ''}
            onChange={(event) =>
              update({
                business: event.target.value.trim() || null,
                page: null,
              })
            }
            placeholder="Business name"
            className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Service
          <input
            value={searchParams.get('service') ?? ''}
            onChange={(event) =>
              update({
                service: event.target.value.trim() || null,
                page: null,
              })
            }
            placeholder="Service name"
            className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Starts from
          <input
            type="date"
            value={searchParams.get('startFrom') ?? ''}
            onChange={(event) =>
              update({ startFrom: event.target.value || null, page: null })
            }
            className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Starts to
          <input
            type="date"
            value={searchParams.get('startTo') ?? ''}
            onChange={(event) =>
              update({ startTo: event.target.value || null, page: null })
            }
            className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <button
          type="button"
          onClick={() =>
            update({
              business: null,
              page: null,
              reference: null,
              service: null,
              startFrom: null,
              startTo: null,
              status: null,
              traveler: null,
            })
          }
          className="self-end rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-emerald-700 hover:text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
        >
          Clear filters
        </button>
      </section>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="rounded-xl border border-slate-200 bg-white p-6 text-slate-600 shadow-sm">
          Loading booking records…
        </p>
      ) : null}
      {!loading && page?.data.length ? (
        <>
          <p className="text-sm text-slate-600">
            {page.meta.total} booking{page.meta.total === 1 ? '' : 's'} found
          </p>
          <div className="space-y-4">
            {page.data.map((booking) => (
              <article
                key={booking.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {booking.reference}
                    </p>
                    <h2 className="mt-1 text-lg font-bold text-slate-950">
                      {booking.service.name}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {booking.business.name} · {travelerName(booking)}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <BookingStatusBadge status={booking.bookingStatus} />
                    <PaymentStatusBadge status={booking.paymentStatus} />
                  </div>
                </div>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="font-semibold text-slate-700">Schedule</dt>
                    <dd className="mt-1 text-slate-600">
                      {formatBookingDate(booking.startAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-700">Amount</dt>
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
                <Link
                  href={'/admin/bookings/' + booking.id}
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 hover:text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                >
                  Investigate booking <ArrowRight className="h-4 w-4" />
                </Link>
              </article>
            ))}
          </div>
        </>
      ) : null}
      {!loading && !error && page && !page.data.length ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center">
          <CalendarSearch className="mx-auto h-8 w-8 text-emerald-700" />
          <h2 className="mt-3 text-lg font-semibold text-slate-950">
            No bookings found
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Adjust the bounded filters to inspect another booking record.
          </p>
        </div>
      ) : null}
      {page && page.meta.totalPages > 1 ? (
        <nav
          aria-label="Booking pagination"
          className="flex justify-center gap-2"
        >
          <button
            type="button"
            disabled={page.meta.page <= 1}
            onClick={() => update({ page: String(page.meta.page - 1) })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page.meta.page >= page.meta.totalPages}
            onClick={() => update({ page: String(page.meta.page + 1) })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-40"
          >
            Next
          </button>
        </nav>
      ) : null}
    </div>
  );
}
