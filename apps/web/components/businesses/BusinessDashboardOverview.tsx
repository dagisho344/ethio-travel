'use client';

import Link from 'next/link';
import {
  ArrowRight,
  CheckCircle2,
  Circle,
  LoaderCircle,
  MapPin,
  ShieldAlert,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { canEditBusiness } from '../../lib/business-management';
import type { ManagedBusiness } from '../../lib/business-management';
import {
  getBusinessDashboard,
  operationError,
} from '../../lib/business-operations';
import type { BusinessDashboard } from '../../lib/business-operations';

function money(value: string, currency: string): string {
  return `${currency} ${Number(value).toLocaleString('en', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function verificationMessage(
  state: ManagedBusiness['verificationSummary'],
): string {
  if (state === 'VERIFIED') return 'Verified';
  if (state === 'PENDING') return 'Verification under review';
  if (state === 'REJECTED') return 'Action required';
  return 'Complete verification';
}

export function BusinessDashboardOverview({
  business,
  hasPrimaryLocation,
}: {
  business: ManagedBusiness;
  hasPrimaryLocation: boolean;
}) {
  const [dashboard, setDashboard] = useState<BusinessDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getBusinessDashboard(business.id)
      .then((value) => {
        if (active) setDashboard(value);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            operationError(
              reason,
              'Operational summary is unavailable right now.',
            ),
          );
        }
      });
    return () => {
      active = false;
    };
  }, [business.id]);

  const canManage = canEditBusiness(business);
  const checks = [
    {
      complete: Boolean(
        business.name && business.description && business.category.id,
      ),
      href: `/businesses/manage/${business.id}/profile`,
      label: 'Business details',
    },
    {
      complete: hasPrimaryLocation,
      href: `/businesses/manage/${business.id}/locations`,
      label: 'Location',
    },
    {
      complete: Boolean(business.phone || business.email || business.website),
      href: `/businesses/manage/${business.id}/profile`,
      label: 'Contact information',
    },
    {
      complete: (business.setup?.serviceCount ?? 0) > 0,
      href: `/businesses/manage/${business.id}/services`,
      label: 'Services',
    },
    {
      complete: (business.setup?.activeMediaCount ?? 0) > 0,
      href: `/businesses/manage/${business.id}/media`,
      label: 'Media',
    },
    {
      complete: business.verificationSummary === 'VERIFIED',
      href: `/businesses/manage/${business.id}/verification`,
      label: 'Verification',
    },
  ];
  const completedChecks = checks.filter((check) => check.complete).length;
  const progress = Math.round((completedChecks / checks.length) * 100);

  if (error) {
    return (
      <p
        role="alert"
        className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
      >
        {error}
      </p>
    );
  }
  if (!dashboard) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        <span className="flex items-center gap-2">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading operational dashboard…
        </span>
      </section>
    );
  }

  const attention = [
    dashboard.bookings.pending > 0
      ? {
          count: dashboard.bookings.pending,
          href: `/businesses/manage/${business.id}/bookings`,
          label: 'booking request',
        }
      : null,
    dashboard.reviews.unansweredCount > 0
      ? {
          count: dashboard.reviews.unansweredCount,
          href: `/businesses/manage/${business.id}/reviews`,
          label: 'published review needing a reply',
        }
      : null,
    dashboard.services.total === 0
      ? {
          count: null,
          href: `/businesses/manage/${business.id}/services`,
          label: 'service to configure',
        }
      : null,
    (business.setup?.activeMediaCount ?? 0) === 0
      ? {
          count: null,
          href: `/businesses/manage/${business.id}/media`,
          label: 'media item to add',
        }
      : null,
    business.verificationSummary !== 'VERIFIED'
      ? {
          count: null,
          href: `/businesses/manage/${business.id}/verification`,
          label: verificationMessage(
            business.verificationSummary,
          ).toLowerCase(),
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  const cards = [
    {
      href: `/businesses/manage/${business.id}/services`,
      label: 'Active services',
      note: `${dashboard.services.total} non-archived`,
      value: String(dashboard.services.active),
    },
    {
      href: `/businesses/manage/${business.id}/bookings`,
      label: 'Booking requests',
      note:
        dashboard.bookings.pending > 0
          ? 'Need attention'
          : `${dashboard.bookings.confirmedUpcoming} confirmed upcoming`,
      value: String(dashboard.bookings.pending),
    },
    {
      href: `/businesses/manage/${business.id}/bookings`,
      label: 'Upcoming confirmed',
      note: 'Confirmed bookings in the future',
      value: String(dashboard.bookings.confirmedUpcoming),
    },
    {
      href: `/businesses/manage/${business.id}/reviews`,
      label: 'Rating & reviews',
      note:
        dashboard.reviews.averageRating === null
          ? `${dashboard.reviews.publishedCount} published review${dashboard.reviews.publishedCount === 1 ? '' : 's'}`
          : `${dashboard.reviews.averageRating.toFixed(1)} average · ${dashboard.reviews.publishedCount} published`,
      value:
        dashboard.reviews.averageRating === null
          ? '—'
          : dashboard.reviews.averageRating.toFixed(1),
    },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-950">
              Operations overview
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Live, database-derived activity for this business.
            </p>
          </div>
          <Link
            href={`/businesses/manage/${business.id}/verification`}
            className="inline-flex w-fit items-center gap-2 rounded-md bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-emerald-50 hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
          >
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            {verificationMessage(business.verificationSummary)}
          </Link>
        </div>
        {dashboard.primaryLocation ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-slate-600">
            <MapPin className="h-4 w-4 text-highland" aria-hidden="true" />
            Primary location: <strong>{dashboard.primaryLocation.label}</strong>
          </p>
        ) : null}
        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className="rounded-md border border-slate-200 bg-slate-50 p-4 transition hover:border-highland hover:bg-emerald-50/50 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
            >
              <p className="text-sm font-medium text-slate-600">{card.label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-950">
                {card.value}
              </p>
              <span className="mt-1 flex items-center gap-1 text-xs leading-5 text-slate-500">
                {card.note}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_minmax(18rem,0.75fr)]">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <h2 className="text-lg font-bold text-slate-950">
            Needs your attention
          </h2>
          {attention.length ? (
            <ul className="mt-4 divide-y divide-slate-100">
              {attention.map((item) => (
                <li key={`${item.href}-${item.label}`}>
                  <Link
                    href={item.href}
                    className="flex items-center justify-between gap-4 py-3 text-sm text-slate-700 transition hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
                  >
                    <span>
                      {item.count === null
                        ? `One ${item.label}`
                        : `${item.count} ${item.label}${item.count === 1 ? '' : 's'}`}
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-highland">
                      Review{' '}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-slate-600">
              You&apos;re all caught up.
            </p>
          )}
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-bold text-slate-950">Business setup</h2>
            <span className="text-sm font-semibold text-slate-600">
              {completedChecks} of {checks.length}
            </span>
          </div>
          <div
            className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"
            aria-label={`${completedChecks} of ${checks.length} setup items complete`}
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={checks.length}
            aria-valuenow={completedChecks}
          >
            <div
              className="h-full rounded-full bg-highland"
              style={{ width: `${progress}%` }}
            />
          </div>
          <ul className="mt-4 space-y-3">
            {checks.map((check) => (
              <li key={check.label} className="flex items-center gap-2 text-sm">
                {check.complete ? (
                  <CheckCircle2
                    className="h-4 w-4 shrink-0 text-highland"
                    aria-hidden="true"
                  />
                ) : (
                  <Circle
                    className="h-4 w-4 shrink-0 text-slate-400"
                    aria-hidden="true"
                  />
                )}
                <span className="min-w-0 flex-1 font-medium text-slate-700">
                  {check.label}
                </span>
                {!check.complete ? (
                  <Link
                    href={check.href}
                    className="shrink-0 font-semibold text-highland hover:text-highland/80 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
                  >
                    {canManage ? 'Complete' : 'View'}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold text-slate-950">Revenue</h2>
        <p className="mt-1 text-sm text-slate-600">
          Captured payment activity grouped by currency. No currency conversion
          is applied.
        </p>
        {dashboard.revenue.length ? (
          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {dashboard.revenue.map((total) => (
              <article
                key={total.currency}
                className="rounded-md bg-slate-50 p-4"
              >
                <p className="font-bold text-slate-950">{total.currency}</p>
                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex justify-between gap-4 text-slate-600">
                    <dt>Gross captured</dt>
                    <dd>{money(total.gross, total.currency)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 text-slate-600">
                    <dt>Refunded</dt>
                    <dd>{money(total.refunded, total.currency)}</dd>
                  </div>
                  <div className="flex justify-between gap-4 border-t border-slate-200 pt-2 font-semibold text-slate-950">
                    <dt>Net</dt>
                    <dd>{money(total.net, total.currency)}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-5 text-sm text-slate-600">
            No captured revenue yet.
          </p>
        )}
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h2 className="text-lg font-bold text-slate-950">Quick actions</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {canManage ? (
            <>
              {business.status !== 'SUSPENDED' ? (
                <>
                  <Link
                    href={`/businesses/manage/${business.id}/services`}
                    className="rounded-md bg-highland px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
                  >
                    Add service
                  </Link>
                  <Link
                    href={`/businesses/manage/${business.id}/availability`}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-highland hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
                  >
                    Manage availability
                  </Link>
                </>
              ) : null}
              <Link
                href={`/businesses/manage/${business.id}/bookings`}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-highland hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
              >
                Manage bookings
              </Link>
              <Link
                href={`/businesses/manage/${business.id}/media`}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-highland hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
              >
                Add media
              </Link>
              <Link
                href={`/businesses/manage/${business.id}/reviews`}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-highland hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
              >
                Reply to reviews
              </Link>
            </>
          ) : (
            <p className="text-sm text-slate-600">
              Your staff role provides read-only access to services,
              availability, and reviews. Use the workspace navigation to review
              current operations.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
