'use client';

import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import {
  AdminBusiness,
  AdminPage,
  adminFetch,
  formatDate,
  statusClass,
} from '../../../lib/admin';

export function AdminBusinessesClient() {
  const [page, setPage] = useState<AdminPage<AdminBusiness> | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState<string | null>(null);
  const load = (nextQuery = query, nextStatus = status) => {
    const params = new URLSearchParams({ limit: '20' });
    if (nextQuery.trim()) params.set('q', nextQuery.trim());
    if (nextStatus) params.set('status', nextStatus);
    setError(null);
    void adminFetch<AdminPage<AdminBusiness>>(`/api/admin/businesses?${params}`)
      .then(setPage)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : 'Businesses unavailable.',
        ),
      );
  };
  useEffect(() => {
    load('', '');
  }, []);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    load();
  }
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
          Administration
        </p>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">Businesses</h1>
        <p className="mt-2 text-slate-600">
          Business lifecycle and verification oversight.
        </p>
      </header>
      <form
        onSubmit={submit}
        className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row"
      >
        <label className="sr-only" htmlFor="business-search">
          Search businesses
        </label>
        <input
          id="business-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search business name or description"
          maxLength={120}
          className="min-h-10 min-w-0 flex-1 rounded-md border border-slate-300 px-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        />
        <label className="sr-only" htmlFor="business-status">
          Business status
        </label>
        <select
          id="business-status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="min-h-10 rounded-md border border-slate-300 px-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="DRAFT">Draft</option>
          <option value="SUSPENDED">Suspended</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <button
          type="submit"
          className="min-h-10 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:ring-offset-2"
        >
          Filter
        </button>
      </form>
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
          {error}
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Verification</th>
              <th className="px-4 py-3">Created</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {page?.data.map((business) => (
              <tr key={business.id}>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/businesses/${business.id}`}
                    className="font-semibold text-slate-950 hover:text-emerald-800"
                  >
                    {business.name}
                  </Link>
                  <p className="mt-1 text-slate-500">
                    {business.category.name} · {business.city.name}
                  </p>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-semibold ${statusClass(business.status)}`}
                  >
                    {business.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-semibold ${statusClass(business.verificationSummary)}`}
                  >
                    {business.verificationSummary}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {formatDate(business.createdAt)}
                </td>
              </tr>
            ))}
            {page && !page.data.length ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  No businesses match these filters.
                </td>
              </tr>
            ) : null}
            {!page ? (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  Loading businesses…
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
