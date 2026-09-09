'use client';

import Link from 'next/link';
import { CalendarDays, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BffRequestError, bffJson, queryString } from '../../lib/private-api';
import {
  formatTripDateRange,
  statusLabel,
  tripStatusOptions,
} from '../../lib/trips';
import type { TripListResponse, TripStatus } from '../../lib/types';

export function TripsClient() {
  const [page, setPage] = useState<TripListResponse | null>(null);
  const [status, setStatus] = useState<TripStatus | ''>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await bffJson<TripListResponse>(
          `/api/trips${queryString({ page: currentPage, limit: 9, status })}`,
        );
        if (current) setPage(result);
      } catch (requestError) {
        if (!current) return;
        setPage(null);
        setError(
          requestError instanceof BffRequestError && requestError.status === 401
            ? 'Your session has ended. Please sign in again.'
            : 'We could not load your trips right now.',
        );
      } finally {
        if (current) setLoading(false);
      }
    };
    void load();
    return () => {
      current = false;
    };
  }, [currentPage, status]);

  return (
    <section aria-label="Trips">
      <div className="mb-6 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <label className="text-sm font-semibold text-slate-700">
          Trip status
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as TripStatus | '');
              setCurrentPage(1);
            }}
            className="mt-1.5 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-highland focus:ring-2 focus:ring-highland/20 sm:w-52"
          >
            <option value="">All trips</option>
            {tripStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <Link
          href="/trips/new"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-highland px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Plan a trip
        </Link>
      </div>

      {error ? (
        <p
          role="alert"
          className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900"
        >
          {error}
        </p>
      ) : null}
      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Loading your trips...
        </div>
      ) : page?.data.length ? (
        <>
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {page.data.map((trip) => (
              <article
                key={trip.id}
                className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-highland">
                      {statusLabel(trip.status)}
                    </p>
                    <h2 className="mt-1 text-lg font-bold text-slate-950">
                      {trip.title}
                    </h2>
                  </div>
                  <CalendarDays
                    className="h-5 w-5 shrink-0 text-slate-400"
                    aria-hidden="true"
                  />
                </div>
                <p className="mt-3 text-sm font-medium text-slate-700">
                  {formatTripDateRange(trip.startDate, trip.endDate)}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {trip.primaryDestination?.name ??
                    trip.destinationCity?.name ??
                    'Destination to be decided'}
                </p>
                <p className="mt-4 text-sm text-slate-500">
                  {trip.dayCount} itinerary day{trip.dayCount === 1 ? '' : 's'}
                </p>
                <Link
                  href={`/trips/${trip.id}`}
                  className="mt-5 inline-flex text-sm font-semibold text-highland hover:text-highland/80 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
                >
                  Open planner
                </Link>
              </article>
            ))}
          </div>
          {page.meta.totalPages > 1 ? (
            <nav
              className="mt-6 flex items-center justify-center gap-2"
              aria-label="Trip pages"
            >
              <button
                type="button"
                disabled={page.meta.page <= 1}
                onClick={() => setCurrentPage((value) => value - 1)}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-sm text-slate-600">
                Page {page.meta.page} of {Math.max(1, page.meta.totalPages)}
              </span>
              <button
                type="button"
                disabled={page.meta.page >= page.meta.totalPages}
                onClick={() => setCurrentPage((value) => value + 1)}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
              >
                Next
              </button>
            </nav>
          ) : null}
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
          <CalendarDays
            className="mx-auto h-10 w-10 text-highland"
            aria-hidden="true"
          />
          <h2 className="mt-4 text-lg font-bold text-slate-950">
            No trips planned yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
            Create a private trip, then add real places and your own bookings
            day by day.
          </p>
          <Link
            href="/trips/new"
            className="mt-5 inline-flex rounded-md bg-highland px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
          >
            Plan your first trip
          </Link>
        </div>
      )}
    </section>
  );
}
