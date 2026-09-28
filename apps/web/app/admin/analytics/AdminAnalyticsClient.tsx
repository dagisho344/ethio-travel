'use client';

import { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { adminFetch, type AdminAnalytics } from '../../../lib/admin';
import { resolveLocale } from '../../../i18n/config';
import { formatLocaleMoney } from '../../../i18n/format';

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
    </div>
  );
}

export function AdminAnalyticsClient() {
  const t = useTranslations('adminPortal');
  const locale = resolveLocale(useLocale());
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void adminFetch<AdminAnalytics>('/api/admin/analytics')
      .then(setAnalytics)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : t('analyticsUnavailable'),
        ),
      );
  }, [t]);

  if (error) {
    return (
      <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
        {error}
      </p>
    );
  }
  if (!analytics)
    return <p className="text-slate-600">{t('loadingAnalytics')}</p>;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
          {t('insights')}
        </p>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">
          {t('platformAnalytics')}
        </h1>
        <p className="mt-2 text-slate-600">{t('analyticsDescription')}</p>
      </header>

      <section
        aria-label={t('platformStatus')}
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <Metric label={t('totalUsers')} value={analytics.users.total} />
        <Metric
          label={t('activeBusinesses')}
          value={analytics.businesses.active}
        />
        <Metric label={t('totalBookings')} value={analytics.bookings.total} />
        <Metric
          label={t('openReports')}
          value={analytics.content.openReports}
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">{t('bookings')}</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">{t('pending')}</dt>
              <dd className="font-semibold text-slate-900">
                {analytics.bookings.pending}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">{t('confirmed')}</dt>
              <dd className="font-semibold text-slate-900">
                {analytics.bookings.confirmed}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">{t('completed')}</dt>
              <dd className="font-semibold text-slate-900">
                {analytics.bookings.completed}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">{t('cancelled')}</dt>
              <dd className="font-semibold text-slate-900">
                {analytics.bookings.cancelled}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">{t('last30Days')}</dt>
              <dd className="font-semibold text-slate-900">
                {analytics.bookings.recentVolume}
              </dd>
            </div>
          </dl>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">
            {t('paymentStatus')}
          </h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">{t('pending')}</dt>
              <dd className="font-semibold text-slate-900">
                {analytics.payments.byStatus.pending}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">{t('paid')}</dt>
              <dd className="font-semibold text-slate-900">
                {analytics.payments.byStatus.paid}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">{t('partiallyRefunded')}</dt>
              <dd className="font-semibold text-slate-900">
                {analytics.payments.byStatus.partiallyRefunded}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">{t('refunded')}</dt>
              <dd className="font-semibold text-slate-900">
                {analytics.payments.byStatus.refunded}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">{t('failed')}</dt>
              <dd className="font-semibold text-slate-900">
                {analytics.payments.byStatus.failed}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-emerald-800" />
          <h2 className="text-lg font-bold text-slate-950">
            {t('capturedRevenue')}
          </h2>
        </div>
        {analytics.payments.revenueByCurrency.length ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {analytics.payments.revenueByCurrency.map((revenue) => (
              <div
                key={revenue.currency}
                className="rounded-lg bg-slate-50 p-4"
              >
                <p className="font-semibold text-slate-950">
                  {revenue.currency}
                </p>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-600">{t('grossCaptured')}</dt>
                    <dd>
                      {formatLocaleMoney(
                        revenue.gross,
                        revenue.currency,
                        locale,
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-600">{t('refunded')}</dt>
                    <dd>
                      {formatLocaleMoney(
                        revenue.refunded,
                        revenue.currency,
                        locale,
                      )}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-slate-200 pt-2 font-semibold">
                    <dt>{t('net')}</dt>
                    <dd>
                      {formatLocaleMoney(revenue.net, revenue.currency, locale)}
                    </dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600">{t('noRevenue')}</p>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">
            {t('usersBusinesses')}
          </h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">{t('recentRegistrations')}</dt>
              <dd className="font-semibold">
                {analytics.users.recentRegistrations}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">{t('suspendedUsers')}</dt>
              <dd className="font-semibold">{analytics.users.suspended}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t('draftBusinesses')}</dt>
              <dd className="font-semibold">{analytics.businesses.draft}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t('suspendedBusinesses')}</dt>
              <dd className="font-semibold">
                {analytics.businesses.suspended}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">{t('verifiedBusinesses')}</dt>
              <dd className="font-semibold">{analytics.businesses.verified}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t('pendingVerification')}</dt>
              <dd className="font-semibold">
                {analytics.businesses.pendingVerification}
              </dd>
            </div>
          </dl>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">
            {t('contentModeration')}
          </h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">{t('publishedDestinations')}</dt>
              <dd className="font-semibold">
                {analytics.content.publishedDestinations}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">{t('publishedReviews')}</dt>
              <dd className="font-semibold">
                {analytics.content.publishedReviews}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">{t('openReports')}</dt>
              <dd className="font-semibold">{analytics.content.openReports}</dd>
            </div>
            <div>
              <dt className="text-slate-500">{t('pendingVerifications')}</dt>
              <dd className="font-semibold">
                {analytics.content.pendingVerifications}
              </dd>
            </div>
          </dl>
        </section>
      </div>
    </div>
  );
}
