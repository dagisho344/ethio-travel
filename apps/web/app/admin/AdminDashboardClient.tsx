'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  AdminDashboard,
  adminFetch,
  displayName,
  statusClass,
} from '../../lib/admin';
import { resolveLocale } from '../../i18n/config';
import { formatLocaleDate } from '../../i18n/format';

function Metric({
  label,
  value,
  href,
}: {
  href: string;
  label: string;
  value: number;
}) {
  const t = useTranslations('adminPortal');
  return (
    <Link
      href={href}
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-emerald-300 hover:shadow"
    >
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
      <span className="mt-3 inline-block text-sm font-semibold text-emerald-800">
        {t('viewDetails')} →
      </span>
    </Link>
  );
}

export function AdminDashboardClient() {
  const t = useTranslations('adminPortal');
  const locale = resolveLocale(useLocale());
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void adminFetch<AdminDashboard>('/api/admin/dashboard')
      .then(setDashboard)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : t('dashboardUnavailable'),
        ),
      );
  }, [t]);

  if (error)
    return (
      <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
        {error}
      </p>
    );
  if (!dashboard)
    return <p className="text-slate-600">{t('loadingDashboard')}</p>;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
          {t('administration')}
        </p>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">
          {t('operationsOverview')}
        </h1>
        <p className="mt-2 text-slate-600">{t('dashboardDescription')}</p>
      </header>
      <section
        aria-label={t('keyMetrics')}
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <Metric
          label={t('activeUsers')}
          value={dashboard.users.active}
          href="/admin/users?status=ACTIVE"
        />
        <Metric
          label={t('suspendedUsers')}
          value={dashboard.users.suspended}
          href="/admin/users?status=SUSPENDED"
        />
        <Metric
          label={t('activeBusinesses')}
          value={dashboard.businesses.active}
          href="/admin/businesses?status=ACTIVE"
        />
        <Metric
          label={t('pendingVerifications')}
          value={dashboard.verifications.pending}
          href="/admin/verifications"
        />
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-950">
          {t('operationsTools')}
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          {t('operationsToolsDescription')}
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/admin/bookings"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-emerald-800 transition hover:border-emerald-500 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            {t('investigateBookings')}
          </Link>
          <Link
            href="/admin/payments"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-emerald-800 transition hover:border-emerald-500 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            {t('inspectPayments')}
          </Link>
          <Link
            href="/admin/analytics"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-emerald-800 transition hover:border-emerald-500 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            {t('viewAnalytics')}
          </Link>
        </div>
      </section>
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-950">
              {t('recentUsers')}
            </h2>
            <Link
              href="/admin/users"
              className="text-sm font-semibold text-emerald-800"
            >
              {t('allUsers')} →
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-slate-100">
            {dashboard.recent.users.map((user) => (
              <li
                key={user.id}
                className="flex items-center justify-between gap-4 py-3"
              >
                <Link
                  href={`/admin/users/${user.id}`}
                  className="min-w-0 font-semibold text-slate-900 hover:text-emerald-800"
                >
                  {displayName(user)}
                </Link>
                <span
                  className={`shrink-0 rounded-md px-2 py-1 text-xs font-semibold ${statusClass(user.status)}`}
                >
                  {user.status}
                </span>
              </li>
            ))}
            {!dashboard.recent.users.length ? (
              <li className="py-3 text-sm text-slate-500">{t('noUsers')}</li>
            ) : null}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-950">
              {t('recentAdminActions')}
            </h2>
            <Link
              href="/admin/audit"
              className="text-sm font-semibold text-emerald-800"
            >
              {t('auditLog')} →
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-slate-100">
            {dashboard.recent.adminActions.map((entry) => (
              <li key={entry.id} className="py-3">
                <p className="font-semibold text-slate-900">{entry.action}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {entry.actor ? displayName(entry.actor) : t('systemActor')} ·{' '}
                  {formatLocaleDate(entry.createdAt, locale)}
                </p>
              </li>
            ))}
            {!dashboard.recent.adminActions.length ? (
              <li className="py-3 text-sm text-slate-500">
                {t('noAdminActions')}
              </li>
            ) : null}
          </ul>
        </div>
      </section>
    </div>
  );
}
