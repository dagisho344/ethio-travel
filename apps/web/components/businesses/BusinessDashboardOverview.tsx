'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  getBusinessDashboard,
  operationError,
} from '../../lib/business-operations';
import type { BusinessDashboard } from '../../lib/business-operations';

function money(value: string, currency: string): string {
  return `${currency} ${Number(value).toLocaleString('en', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function BusinessDashboardOverview({
  businessId,
}: {
  businessId: string;
}) {
  const [dashboard, setDashboard] = useState<BusinessDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getBusinessDashboard(businessId)
      .then((value) => {
        if (active) setDashboard(value);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            operationError(
              reason,
              'Operational summary is unavailable right now.',
            ),
          );
      });
    return () => {
      active = false;
    };
  }, [businessId]);

  if (error)
    return (
      <p
        role="alert"
        className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
      >
        {error}
      </p>
    );
  if (!dashboard)
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
        Loading operational dashboard...
      </section>
    );

  const cards = [
    [
      'Active services',
      String(dashboard.services.active),
      `${dashboard.services.total} non-archived`,
    ],
    [
      'Booking requests',
      String(dashboard.bookings.pending),
      `${dashboard.bookings.confirmedUpcoming} confirmed upcoming`,
    ],
    [
      'Published reviews',
      String(dashboard.reviews.publishedCount),
      dashboard.reviews.averageRating === null
        ? 'No public rating yet'
        : `${dashboard.reviews.averageRating.toFixed(1)} average rating`,
    ],
    [
      'Reviews to answer',
      String(dashboard.reviews.unansweredCount),
      'Published reviews without an official reply',
    ],
  ];

  return (
    <section
      aria-labelledby="operations-dashboard"
      className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2
            id="operations-dashboard"
            className="text-lg font-bold text-slate-950"
          >
            Operations overview
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Database-derived operational totals for this business only.
          </p>
        </div>
        {dashboard.primaryLocation ? (
          <p className="text-sm text-slate-600">
            Primary location: <strong>{dashboard.primaryLocation.label}</strong>
          </p>
        ) : null}
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map(([label, value, note]) => (
          <article key={label} className="rounded-md bg-slate-50 p-4">
            <p className="text-sm font-medium text-slate-600">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>
            <p className="mt-1 text-xs leading-5 text-slate-500">{note}</p>
          </article>
        ))}
      </div>
      <div className="mt-5 rounded-md border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-900">Captured revenue</h3>
        {dashboard.revenue.length ? (
          <ul className="mt-2 space-y-1 text-sm text-slate-600">
            {dashboard.revenue.map((total) => (
              <li key={total.currency}>
                {total.currency}: {money(total.net, total.currency)} net (
                {money(total.gross, total.currency)} captured,{' '}
                {money(total.refunded, total.currency)} refunded)
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-slate-600">
            No successfully captured payment transactions yet.
          </p>
        )}
      </div>
      <nav
        aria-label="Business operations"
        className="mt-5 flex flex-wrap gap-2"
      >
        {(
          [
            ['Add service', `/businesses/manage/${businessId}/services`],
            ['Manage bookings', `/businesses/manage/${businessId}/bookings`],
            ['Reply to reviews', `/businesses/manage/${businessId}/reviews`],
            ['Customers', `/businesses/manage/${businessId}/customers`],
            ['Payments', `/businesses/manage/${businessId}/payments`],
          ] as Array<[string, string]>
        ).map(([label, href]) => (
          <Link
            key={href}
            href={href}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-highland hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
          >
            {label}
          </Link>
        ))}
      </nav>
    </section>
  );
}
