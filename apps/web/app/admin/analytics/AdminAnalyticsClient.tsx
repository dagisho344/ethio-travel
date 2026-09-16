'use client';

import { useEffect, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { formatMoney } from '../../../lib/bookings';
import { adminFetch, type AdminAnalytics } from '../../../lib/admin';

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
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void adminFetch<AdminAnalytics>('/api/admin/analytics')
      .then(setAnalytics)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : 'Analytics unavailable.',
        ),
      );
  }, []);

  if (error) {
    return (
      <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
        {error}
      </p>
    );
  }
  if (!analytics) return <p className="text-slate-600">Loading analytics…</p>;

  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
          Insights
        </p>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">
          Platform analytics
        </h1>
        <p className="mt-2 text-slate-600">
          Bounded database aggregates. Revenue remains separated by currency.
        </p>
      </header>

      <section
        aria-label="Platform status"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <Metric label="Total users" value={analytics.users.total} />
        <Metric label="Active businesses" value={analytics.businesses.active} />
        <Metric label="Total bookings" value={analytics.bookings.total} />
        <Metric label="Open reports" value={analytics.content.openReports} />
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">Bookings</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Pending</dt>
              <dd className="font-semibold text-slate-900">
                {analytics.bookings.pending}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Confirmed</dt>
              <dd className="font-semibold text-slate-900">
                {analytics.bookings.confirmed}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Completed</dt>
              <dd className="font-semibold text-slate-900">
                {analytics.bookings.completed}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Cancelled</dt>
              <dd className="font-semibold text-slate-900">
                {analytics.bookings.cancelled}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Last 30 days</dt>
              <dd className="font-semibold text-slate-900">
                {analytics.bookings.recentVolume}
              </dd>
            </div>
          </dl>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">Payment status</h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Pending</dt>
              <dd className="font-semibold text-slate-900">
                {analytics.payments.byStatus.pending}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Paid</dt>
              <dd className="font-semibold text-slate-900">
                {analytics.payments.byStatus.paid}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Partially refunded</dt>
              <dd className="font-semibold text-slate-900">
                {analytics.payments.byStatus.partiallyRefunded}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Refunded</dt>
              <dd className="font-semibold text-slate-900">
                {analytics.payments.byStatus.refunded}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Failed</dt>
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
          <h2 className="text-lg font-bold text-slate-950">Captured revenue</h2>
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
                    <dt className="text-slate-600">Gross captured</dt>
                    <dd>{formatMoney(revenue.gross, revenue.currency)}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="text-slate-600">Refunded</dt>
                    <dd>{formatMoney(revenue.refunded, revenue.currency)}</dd>
                  </div>
                  <div className="flex justify-between gap-3 border-t border-slate-200 pt-2 font-semibold">
                    <dt>Net</dt>
                    <dd>{formatMoney(revenue.net, revenue.currency)}</dd>
                  </div>
                </dl>
              </div>
            ))}
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-600">
            No captured payment revenue yet.
          </p>
        )}
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">
            Users and businesses
          </h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Recent registrations</dt>
              <dd className="font-semibold">
                {analytics.users.recentRegistrations}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Suspended users</dt>
              <dd className="font-semibold">{analytics.users.suspended}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Draft businesses</dt>
              <dd className="font-semibold">{analytics.businesses.draft}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Suspended businesses</dt>
              <dd className="font-semibold">
                {analytics.businesses.suspended}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Verified businesses</dt>
              <dd className="font-semibold">{analytics.businesses.verified}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Pending verification</dt>
              <dd className="font-semibold">
                {analytics.businesses.pendingVerification}
              </dd>
            </div>
          </dl>
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">
            Content and moderation
          </h2>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Published destinations</dt>
              <dd className="font-semibold">
                {analytics.content.publishedDestinations}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Published reviews</dt>
              <dd className="font-semibold">
                {analytics.content.publishedReviews}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Open reports</dt>
              <dd className="font-semibold">{analytics.content.openReports}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Pending verifications</dt>
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
