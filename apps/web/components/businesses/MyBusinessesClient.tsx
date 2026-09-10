'use client';

import Link from 'next/link';
import { Building2, MapPin, Plus } from 'lucide-react';
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
        if (active)
          setError(
            requestErrorMessage(
              requestError,
              'We could not load your businesses right now.',
            ),
          );
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section aria-label="My businesses">
      <div className="mb-6 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-slate-600">
          Create a draft when you are ready to start the verified-business
          setup.
        </p>
        <Link
          href="/business/onboarding"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-md bg-highland px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          List your business
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
          Loading your businesses...
        </div>
      ) : page?.data.length ? (
        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {page.data.map((business) => (
            <article
              key={business.id}
              className="flex min-h-56 flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-highland">
                    {business.currentMember.role.toLowerCase()}
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-slate-950">
                    {business.name}
                  </h2>
                </div>
                <Building2
                  className="h-5 w-5 shrink-0 text-slate-400"
                  aria-hidden="true"
                />
              </div>
              <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                <span
                  className={`rounded-md px-2 py-1 ${statusClass(business.status)}`}
                >
                  {business.status}
                </span>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-slate-700">
                  {verificationLabel(business.verificationSummary)}
                </span>
              </div>
              <p className="mt-3 text-sm font-medium text-slate-700">
                {business.category.name}
              </p>
              <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                {business.city.name}
                {business.destination ? ` · ${business.destination.name}` : ''}
              </p>
              <p className="mt-4 text-sm text-slate-600">
                {nextBusinessAction(business)}
              </p>
              <Link
                href={`/businesses/manage/${business.id}`}
                className="mt-auto pt-5 text-sm font-semibold text-highland transition hover:text-highland/80 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
              >
                {business.status === 'ARCHIVED'
                  ? 'View workspace'
                  : 'Open workspace'}
              </Link>
            </article>
          ))}
        </div>
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
            className="mt-5 inline-flex rounded-md bg-highland px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
          >
            List your business
          </Link>
        </div>
      )}
    </section>
  );
}
