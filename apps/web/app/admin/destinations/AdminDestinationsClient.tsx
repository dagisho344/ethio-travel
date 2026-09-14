'use client';

import Link from 'next/link';
import { FormEvent, useCallback, useEffect, useState } from 'react';
import {
  AdminDestination,
  AdminPage,
  adminFetch,
  statusClass,
} from '../../../lib/admin';

type DestinationStatus = '' | 'DRAFT' | 'PUBLISHED' | 'INACTIVE' | 'ARCHIVED';

export function AdminDestinationsClient() {
  const [page, setPage] = useState<AdminPage<AdminDestination> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<DestinationStatus>('');
  const [requestedPage, setRequestedPage] = useState(1);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const query = new URLSearchParams({
      limit: '20',
      page: String(requestedPage),
    });
    if (search.trim()) query.set('q', search.trim());
    if (status) query.set('status', status);

    try {
      setPage(
        await adminFetch<AdminPage<AdminDestination>>(
          `/api/admin/destinations?${query.toString()}`,
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'Destinations are unavailable.',
      );
    } finally {
      setLoading(false);
    }
  }, [requestedPage, search, status]);

  useEffect(() => {
    void load();
  }, [load]);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setRequestedPage(1);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
            Content management
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">
            Destinations
          </h1>
          <p className="mt-2 text-slate-600">
            Publication is a separate audited action.
          </p>
        </div>
        <Link
          href="/admin/destinations/new"
          className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          Create destination
        </Link>
      </header>

      <form
        onSubmit={applyFilters}
        className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[minmax(0,1fr)_12rem_auto]"
      >
        <label className="text-sm font-semibold text-slate-700">
          Search
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Name or description"
            maxLength={120}
            className="mt-1 block min-h-10 w-full rounded-md border border-slate-300 px-3 font-normal"
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Status
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as DestinationStatus)
            }
            className="mt-1 block min-h-10 w-full rounded-md border border-slate-300 px-3 font-normal"
          >
            <option value="">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="PUBLISHED">Published</option>
            <option value="INACTIVE">Unpublished</option>
            <option value="ARCHIVED">Archived</option>
          </select>
        </label>
        <button
          type="submit"
          className="self-end rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
        >
          Apply filters
        </button>
      </form>

      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
          {error}
        </p>
      ) : null}
      <div className="grid gap-4 md:grid-cols-2">
        {page?.data.map((item) => (
          <article
            key={item.id}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex justify-between gap-3">
              <div>
                <Link
                  href={`/admin/destinations/${item.id}`}
                  className="text-lg font-bold text-slate-950 hover:text-emerald-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                >
                  {item.name}
                </Link>
                <p className="mt-1 text-sm text-slate-600">
                  {item.shortDescription}
                </p>
              </div>
              <span
                className={`h-fit rounded-md px-2 py-1 text-xs font-semibold ${statusClass(item.status)}`}
              >
                {item.status}
              </span>
            </div>
            <Link
              href={`/admin/destinations/${item.id}/edit`}
              className="mt-4 inline-block text-sm font-semibold text-emerald-800 hover:text-emerald-900"
            >
              Edit →
            </Link>
          </article>
        ))}
      </div>
      {page && !page.data.length ? (
        <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
          No destinations found.
        </p>
      ) : null}
      {loading ? <p className="text-slate-600">Loading destinations…</p> : null}
      {page && page.meta.totalPages > 1 ? (
        <nav
          aria-label="Destination pagination"
          className="flex items-center justify-between gap-3"
        >
          <button
            type="button"
            disabled={page.meta.page <= 1 || loading}
            onClick={() => setRequestedPage(page.meta.page - 1)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50"
          >
            Previous
          </button>
          <p className="text-sm text-slate-600">
            Page {page.meta.page} of {page.meta.totalPages}
          </p>
          <button
            type="button"
            disabled={page.meta.page >= page.meta.totalPages || loading}
            onClick={() => setRequestedPage(page.meta.page + 1)}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 disabled:opacity-50"
          >
            Next
          </button>
        </nav>
      ) : null}
    </div>
  );
}
