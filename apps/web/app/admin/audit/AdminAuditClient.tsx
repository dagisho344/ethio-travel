'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  AdminPage,
  AuditEntry,
  adminFetch,
  displayName,
  formatDate,
  statusClass,
} from '../../../lib/admin';

export function AdminAuditClient() {
  const [page, setPage] = useState<AdminPage<AuditEntry> | null>(null);
  const [action, setAction] = useState('');
  const [error, setError] = useState<string | null>(null);
  const load = (selectedAction = action) => {
    const params = new URLSearchParams({ limit: '30' });
    if (selectedAction) params.set('action', selectedAction);
    setError(null);
    void adminFetch<AdminPage<AuditEntry>>(`/api/admin/audit?${params}`)
      .then(setPage)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : 'Audit log unavailable.',
        ),
      );
  };
  useEffect(() => {
    load('');
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
        <h1 className="mt-1 text-3xl font-bold text-slate-950">Audit log</h1>
        <p className="mt-2 text-slate-600">
          Append-only, safe administrative activity history.
        </p>
      </header>
      <form
        onSubmit={submit}
        className="flex gap-3 rounded-xl border border-slate-200 bg-white p-4"
      >
        <label className="sr-only" htmlFor="audit-action">
          Audit action
        </label>
        <select
          id="audit-action"
          value={action}
          onChange={(event) => setAction(event.target.value)}
          className="min-h-10 flex-1 rounded-md border border-slate-300 px-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        >
          <option value="">All actions</option>
          <option value="ADMIN_USER_SUSPENDED">User suspended</option>
          <option value="ADMIN_USER_RESTORED">User restored</option>
          <option value="ADMIN_BUSINESS_SUSPENDED">Business suspended</option>
          <option value="ADMIN_BUSINESS_RESTORED">Business restored</option>
          <option value="ADMIN_VERIFICATION_APPROVED">
            Verification approved
          </option>
          <option value="ADMIN_VERIFICATION_REJECTED">
            Verification rejected
          </option>
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
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Actor</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Entity</th>
              <th className="px-4 py-3">Outcome</th>
              <th className="px-4 py-3">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {page?.data.map((entry) => (
              <tr key={entry.id}>
                <td className="px-4 py-3 text-slate-700">
                  {formatDate(entry.createdAt)}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {entry.actor ? displayName(entry.actor) : 'System'}
                </td>
                <td className="px-4 py-3 font-semibold text-slate-900">
                  {entry.action}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {entry.entityType}
                  {entry.entityId ? ` · ${entry.entityId.slice(0, 8)}…` : ''}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-semibold ${statusClass(entry.outcome)}`}
                  >
                    {entry.outcome}
                  </span>
                </td>
                <td className="max-w-xs px-4 py-3 text-slate-700">
                  {entry.reason ?? '—'}
                </td>
              </tr>
            ))}
            {page && !page.data.length ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  No audit records match this filter.
                </td>
              </tr>
            ) : null}
            {!page ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  Loading audit records…
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
