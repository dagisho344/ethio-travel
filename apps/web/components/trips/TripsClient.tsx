'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { CalendarDays, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import { BffRequestError, bffJson, queryString } from '../../lib/private-api';
import { tripStatusOptions } from '../../lib/trips';
import type { TripListResponse, TripStatus } from '../../lib/types';
import { resolveLocale } from '../../i18n/config';
import { formatLocaleCalendarDate } from '../../i18n/format';

function statusKey(status: TripStatus) {
  return (
    {
      DRAFT: 'draft',
      UPCOMING: 'upcoming',
      IN_PROGRESS: 'inProgress',
      COMPLETED: 'completed',
      ARCHIVED: 'archived',
    } as const
  )[status];
}

function tripDateRange(
  startDate: string,
  endDate: string,
  locale: 'en' | 'am',
) {
  const start = formatLocaleCalendarDate(startDate, locale);
  const end = formatLocaleCalendarDate(endDate, locale);
  return start === end ? start : `${start} – ${end}`;
}

export function TripsClient() {
  const t = useTranslations('trips');
  const locale = resolveLocale(useLocale());
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
            ? t('sessionEnded')
            : t('loadError'),
        );
      } finally {
        if (current) setLoading(false);
      }
    };
    void load();
    return () => {
      current = false;
    };
  }, [currentPage, status, t]);

  return (
    <section aria-label={t('title')}>
      <div className="mb-6 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <label className="text-sm font-semibold text-slate-700">
          {t('status')}
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as TripStatus | '');
              setCurrentPage(1);
            }}
            className="mt-1.5 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-highland focus:ring-2 focus:ring-highland/20 sm:w-52"
          >
            <option value="">{t('allTrips')}</option>
            {tripStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {t(statusKey(option.value))}
              </option>
            ))}
          </select>
        </label>
        <Link
          href="/trips/new"
          className="inline-flex items-center justify-center gap-2 rounded-md bg-highland px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          {t('planTrip')}
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
          {t('loadingTrips')}
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
                      {t(statusKey(trip.status))}
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
                  {tripDateRange(trip.startDate, trip.endDate, locale)}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  {trip.primaryDestination?.name ??
                    trip.destinationCity?.name ??
                    t('destinationPending')}
                </p>
                <p className="mt-4 text-sm text-slate-500">
                  {t('dayCount', { count: trip.dayCount })}
                </p>
                <Link
                  href={`/trips/${trip.id}`}
                  className="mt-5 inline-flex text-sm font-semibold text-highland hover:text-highland/80 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
                >
                  {t('openPlanner')}
                </Link>
              </article>
            ))}
          </div>
          {page.meta.totalPages > 1 ? (
            <nav
              className="mt-6 flex items-center justify-center gap-2"
              aria-label={t('title')}
            >
              <button
                type="button"
                disabled={page.meta.page <= 1}
                onClick={() => setCurrentPage((value) => value - 1)}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
              >
                {t('previous')}
              </button>
              <span className="text-sm text-slate-600">
                {t('pageOf', {
                  page: page.meta.page,
                  total: Math.max(1, page.meta.totalPages),
                })}
              </span>
              <button
                type="button"
                disabled={page.meta.page >= page.meta.totalPages}
                onClick={() => setCurrentPage((value) => value + 1)}
                className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
              >
                {t('next')}
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
            {t('noTrips')}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
            {t('noTripsDescription')}
          </p>
          <Link
            href="/trips/new"
            className="mt-5 inline-flex rounded-md bg-highland px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
          >
            {t('planFirstTrip')}
          </Link>
        </div>
      )}
    </section>
  );
}
