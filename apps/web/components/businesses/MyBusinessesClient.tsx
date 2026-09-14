'use client';

import Link from 'next/link';
import { ArrowRight, Building2, MapPin, Plus } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  getManagedBusinesses,
  nextBusinessAction,
  requestErrorMessage,
  verificationLabel,
} from '../../lib/business-management';
import type { ManagedBusinessesResponse } from '../../lib/business-management';

function statusClass(status: string): string {
  if (status === 'SUSPENDED') return 'bg-red-50 text-red-800';
  if (status === 'ARCHIVED') return 'bg-slate-100 text-slate-700';
  if (status === 'ACTIVE') return 'bg-emerald-50 text-emerald-800';
  return 'bg-amber-50 text-amber-900';
}

export function MyBusinessesClient() {
  const [page, setPage] = useState<ManagedBusinessesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const result = await getManagedBusinesses();
        if (active) setPage(result);
      } catch (requestError) {
        if (active) {
          setError(
            requestErrorMessage(
              requestError,
              'We could not load your businesses right now.',
            ),
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  const businesses = page?.data ?? [];
  const hasBusinesses = businesses.length > 0;

  return (
    <section aria-label="My businesses">
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
          Loading your businesses…
        </div>
      ) : hasBusinesses ? (
        <>
          <div className="mb-6 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">
              Manage the businesses where you are an active member.
            </p>
            <Link
              href="/business/onboarding"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md border border-highland px-3 py-2 text-sm font-semibold text-highland transition hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
              Add another business
            </Link>
          </div>
          <div className="grid gap-5 md:grid-cols-2">
            {businesses.map((business) => (
              <article
                key={business.id}
                className="flex min-h-64 flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <h2 className="truncate text-xl font-bold text-slate-950">
                      {business.name}
                    </h2>
                    <p className="mt-2 text-sm font-medium text-slate-700">
                      {business.category.name}
                      <span className="text-slate-400"> · </span>
                      {business.destination?.name ?? business.city.name}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                      <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                      {business.city.name}
                    </p>
                  </div>
                  <Building2
                    className="h-6 w-6 shrink-0 text-slate-400"
                    aria-hidden="true"
                  />
                </div>
                <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold">
                  <span
                    className={`rounded-md px-2.5 py-1 ${statusClass(business.status)}`}
                  >
                    {business.status}
                  </span>
                  <span className="rounded-md bg-slate-100 px-2.5 py-1 text-slate-700">
                    {verificationLabel(business.verificationSummary)}
                  </span>
                </div>
                <p className="mt-4 text-sm text-slate-600">
                  {nextBusinessAction(business)}
                </p>
                <div className="mt-auto flex items-end justify-between gap-4 pt-6">
                  <p className="text-sm text-slate-600">
                    Your role:{' '}
                    <strong className="text-slate-900">
                      {business.currentMember.role.toLowerCase()}
                    </strong>
                  </p>
                  <Link
                    href={`/businesses/manage/${business.id}`}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-highland px-3 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
                  >
                    {business.status === 'ARCHIVED'
                      ? 'View Dashboard'
                      : 'Open Dashboard'}
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
          <Building2
            className="mx-auto h-10 w-10 text-highland"
            aria-hidden="true"
          />
          <h2 className="mt-4 text-lg font-bold text-slate-950">
            No businesses yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
            Create a private business draft. It will not appear in public
            discovery until the established verification process approves it.
          </p>
          <Link
            href="/business/onboarding"
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-highland px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            List your business
          </Link>
        </div>
      )}
    </section>
  );
}
