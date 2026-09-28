'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  AdminPage,
  AdminReport,
  adminFetch,
  statusClass,
} from '../../../lib/admin';
import { resolveLocale } from '../../../i18n/config';
import { formatLocaleDate } from '../../../i18n/format';

export function AdminReportsClient() {
  const t = useTranslations('adminPortal');
  const locale = resolveLocale(useLocale());
  const [page, setPage] = useState<AdminPage<AdminReport> | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  function load(nextQuery = query, nextStatus = status) {
    const params = new URLSearchParams({ limit: '20' });
    if (nextQuery.trim()) params.set('q', nextQuery.trim());
    if (nextStatus) params.set('status', nextStatus);
    void adminFetch<AdminPage<AdminReport>>(`/api/admin/reports?${params}`)
      .then(setPage)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : t('reportsUnavailable'),
        ),
      );
  }
  useEffect(() => load('', ''), [t]);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    load();
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
          {t('trustSafety')}
        </p>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">
          {t('reports')}
        </h1>
        <p className="mt-2 text-slate-600">{t('reportsDescription')}</p>
      </header>
      <form
        onSubmit={submit}
        className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row"
      >
        <label className="sr-only" htmlFor="report-search">
          {t('searchReports')}
        </label>
        <input
          id="report-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          maxLength={120}
          placeholder={t('searchReportsPlaceholder')}
          className="min-h-10 min-w-0 flex-1 rounded border border-slate-300 px-3"
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label={t('reportStatus')}
          className="min-h-10 rounded border border-slate-300 px-3"
        >
          <option value="">{t('allStatuses')}</option>
          <option value="OPEN">{t('open')}</option>
          <option value="UNDER_REVIEW">{t('underReview')}</option>
          <option value="RESOLVED">{t('resolved')}</option>
          <option value="DISMISSED">{t('dismissed')}</option>
        </select>
        <button
          type="submit"
          className="rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white"
        >
          {t('filter')}
        </button>
      </form>
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
          {error}
        </p>
      ) : null}
      <div className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white shadow-sm">
        {page?.data.map((report) => (
          <article
            key={report.id}
            className="flex flex-col justify-between gap-3 p-4 sm:flex-row sm:items-center"
          >
            <div>
              <Link
                href={`/admin/reports/${report.id}`}
                className="font-semibold text-slate-950 hover:text-emerald-800"
              >
                {t('reportSuffix', { type: report.targetType })}
              </Link>
              <p className="mt-1 text-sm text-slate-600">
                {report.reason} ·{' '}
                {t('reporter', { name: report.reporter.displayName })}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {formatLocaleDate(report.createdAt, locale)}
              </p>
            </div>
            <span
              className={`h-fit rounded px-2 py-1 text-xs font-semibold ${statusClass(report.status)}`}
            >
              {report.status}
            </span>
          </article>
        ))}
      </div>
      {page && !page.data.length ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          {t('noReports')}
        </p>
      ) : null}
      {!page ? <p className="text-slate-600">{t('loadingReports')}</p> : null}
    </div>
  );
}
