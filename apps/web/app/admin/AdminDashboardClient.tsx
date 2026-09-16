'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  AdminDashboard,
  adminFetch,
  displayName,
  formatDate,
  statusClass,
} from '../../lib/admin';

function Metric({
  label,
  value,
  href,
}: {
  href: string;
  label: string;
  value: number;
}) {
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
        View details →
      </span>
    </Link>
  );
}

export function AdminDashboardClient() {
  const [dashboard, setDashboard] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void adminFetch<AdminDashboard>('/api/admin/dashboard')
      .then(setDashboard)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : 'Dashboard unavailable.',
        ),
      );
  }, []);

  if (error)
    return (
      <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
        {error}
      </p>
    );
  if (!dashboard)
    return <p className="text-slate-600">Loading administrator dashboard…</p>;

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
          Administration
        </p>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">
          Operations overview
        </h1>
        <p className="mt-2 text-slate-600">
          Live, bounded summaries derived from EthioTravel records.
        </p>
      </header>
      <section
        aria-label="Key administrator metrics"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <Metric
          label="Active users"
          value={dashboard.users.active}
          href="/admin/users?status=ACTIVE"
        />
        <Metric
          label="Suspended users"
          value={dashboard.users.suspended}
          href="/admin/users?status=SUSPENDED"
        />
        <Metric
          label="Active businesses"
          value={dashboard.businesses.active}
          href="/admin/businesses?status=ACTIVE"
        />
        <Metric
          label="Pending verifications"
          value={dashboard.verifications.pending}
          href="/admin/verifications"
        />
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-950">Operations tools</h2>
        <p className="mt-1 text-sm text-slate-600">
          Investigate operational records and review aggregate platform health.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/admin/bookings"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-emerald-800 transition hover:border-emerald-500 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            Investigate bookings
          </Link>
          <Link
            href="/admin/payments"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-emerald-800 transition hover:border-emerald-500 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            Inspect payments
          </Link>
          <Link
            href="/admin/analytics"
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-emerald-800 transition hover:border-emerald-500 hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            View analytics
          </Link>
        </div>
      </section>
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-950">Recent users</h2>
            <Link
              href="/admin/users"
              className="text-sm font-semibold text-emerald-800"
            >
              All users →
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
              <li className="py-3 text-sm text-slate-500">No users yet.</li>
            ) : null}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-950">
              Recent admin actions
            </h2>
            <Link
              href="/admin/audit"
              className="text-sm font-semibold text-emerald-800"
            >
              Audit log →
            </Link>
          </div>
          <ul className="mt-4 divide-y divide-slate-100">
            {dashboard.recent.adminActions.map((entry) => (
              <li key={entry.id} className="py-3">
                <p className="font-semibold text-slate-900">{entry.action}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {entry.actor ? displayName(entry.actor) : 'System'} ·{' '}
                  {formatDate(entry.createdAt)}
                </p>
              </li>
            ))}
            {!dashboard.recent.adminActions.length ? (
              <li className="py-3 text-sm text-slate-500">
                No administrative actions yet.
              </li>
            ) : null}
          </ul>
        </div>
      </section>
    </div>
  );
}
