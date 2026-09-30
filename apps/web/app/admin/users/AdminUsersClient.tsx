'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { resolveLocale } from '../../../i18n/config';
import { formatLocaleDate } from '../../../i18n/format';
import {
  AdminPage,
  AdminUser,
  adminFetch,
  displayName,
  statusClass,
} from '../../../lib/admin';

export function AdminUsersClient() {
  const t = useTranslations('adminPortal');
  const tu = useTranslations('adminUsers');
  const locale = resolveLocale(useLocale());
  const [page, setPage] = useState<AdminPage<AdminUser> | null>(null);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('');
  const [role, setRole] = useState('');
  const [pageNumber, setPageNumber] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const requestVersion = useRef(0);

  const load = (
    nextQuery = query,
    nextStatus = status,
    nextRole = role,
    nextPage = pageNumber,
  ) => {
    const version = ++requestVersion.current;
    const params = new URLSearchParams({ limit: '20', page: String(nextPage) });
    if (nextQuery.trim()) params.set('q', nextQuery.trim());
    if (nextStatus) params.set('status', nextStatus);
    if (nextRole) params.set('role', nextRole);
    setPageNumber(nextPage);
    setPage(null);
    setError(null);
    void adminFetch<AdminPage<AdminUser>>(`/api/admin/users?${params}`)
      .then((data) => {
        if (requestVersion.current === version) setPage(data);
      })
      .catch((cause: unknown) => {
        if (requestVersion.current === version)
          setError(
            cause instanceof Error ? cause.message : t('usersUnavailable'),
          );
      });
  };

  useEffect(() => {
    load('', '', '', 1);
  }, []);
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    load(query, status, role, 1);
  }

  const statusLabel = (value: string) =>
    value === 'ACTIVE'
      ? tu('statusActive')
      : value === 'SUSPENDED'
        ? tu('statusSuspended')
        : value === 'DEACTIVATED'
          ? tu('statusDeactivated')
          : value;
  const roleLabel = (value: string) =>
    value === 'TRAVELER'
      ? tu('roleTraveler')
      : value === 'BUSINESS_OWNER'
        ? tu('roleBusinessOwner')
        : value === 'BUSINESS_STAFF'
          ? tu('roleBusinessStaff')
          : value === 'ADMIN'
            ? tu('roleAdmin')
            : value;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
            {t('administration')}
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">
            {t('users')}
          </h1>
          <p className="mt-2 text-slate-600">{t('usersDescription')}</p>
        </div>
        <Link
          href="/admin/users/new"
          className="inline-flex min-h-10 items-center rounded-md bg-emerald-700 px-4 font-semibold text-white hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:ring-offset-2"
        >
          + {tu('addUser')}
        </Link>
      </header>
      <form
        onSubmit={submit}
        className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:flex-wrap"
      >
        <label className="sr-only" htmlFor="user-search">
          {t('searchUsers')}
        </label>
        <input
          id="user-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t('searchUsersPlaceholder')}
          maxLength={120}
          className="min-h-10 min-w-0 flex-1 rounded-md border border-slate-300 px-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        />
        <label className="sr-only" htmlFor="user-status">
          {t('userStatus')}
        </label>
        <select
          id="user-status"
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="min-h-10 rounded-md border border-slate-300 px-3 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
        >
          <option value="">{t('allStatuses')}</option>
          <option value="ACTIVE">{t('active')}</option>
          <option value="SUSPENDED">{t('suspended')}</option>
          <option value="DEACTIVATED">{tu('statusDeactivated')}</option>
        </select>
        <label className="sr-only" htmlFor="user-role">
          {tu('roles')}
        </label>
        <select
          id="user-role"
          value={role}
          onChange={(event) => setRole(event.target.value)}
          className="min-h-10 rounded-md border border-slate-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
        >
          <option value="">{tu('allRoles')}</option>
          <option value="TRAVELER">{tu('roleTraveler')}</option>
          <option value="BUSINESS_OWNER">{tu('roleBusinessOwner')}</option>
          <option value="BUSINESS_STAFF">{tu('roleBusinessStaff')}</option>
          <option value="ADMIN">{tu('roleAdmin')}</option>
        </select>
        <button
          type="submit"
          className="min-h-10 rounded-md bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-700 focus:ring-offset-2"
        >
          {t('filter')}
        </button>
      </form>
      {error ? (
        <div role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
          {error}{' '}
          <button
            type="button"
            onClick={() => load()}
            className="ml-2 underline focus:outline-none focus:ring-2 focus:ring-emerald-600"
          >
            {tu('retry')}
          </button>
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">{t('users')}</th>
              <th className="px-4 py-3">{t('status')}</th>
              <th className="px-4 py-3">{t('roles')}</th>
              <th className="px-4 py-3">{t('businessMemberships')}</th>
              <th className="px-4 py-3">{t('created')}</th>
              <th className="px-4 py-3">{tu('lastLogin')}</th>
              <th className="px-4 py-3">{tu('view')}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {page?.data.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="font-semibold text-slate-950 hover:text-emerald-800"
                  >
                    {displayName(user)}
                  </Link>
                  <p className="mt-1 text-slate-500">{user.email}</p>
                  {user.phone ? (
                    <p className="text-slate-500">{user.phone}</p>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-semibold ${statusClass(user.status)}`}
                  >
                    {statusLabel(user.status)}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {user.roles.map(roleLabel).join(', ') || '—'}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {user.businessMembershipCount}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {formatLocaleDate(user.createdAt, locale)}
                </td>
                <td className="px-4 py-3 text-slate-700">
                  {user.lastLoginAt
                    ? formatLocaleDate(user.lastLoginAt, locale)
                    : tu('never')}
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/admin/users/${user.id}`}
                    className="font-semibold text-emerald-800 underline focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    {tu('view')}
                  </Link>
                </td>
              </tr>
            ))}
            {page && !page.data.length ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  {t('noUsersMatch')}
                </td>
              </tr>
            ) : null}
            {!page && !error ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-slate-500"
                >
                  {t('loadingUsers')}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      {page && page.meta.totalPages > 1 ? (
        <nav
          aria-label={t('users')}
          className="flex flex-wrap items-center justify-center gap-3"
        >
          <button
            type="button"
            disabled={pageNumber <= 1}
            onClick={() => load(query, status, role, pageNumber - 1)}
            className="rounded-md border border-slate-300 px-3 py-2 disabled:opacity-50"
          >
            ←
          </button>
          <span>
            {t('pageOf', { page: pageNumber, total: page.meta.totalPages })}
          </span>
          <button
            type="button"
            disabled={pageNumber >= page.meta.totalPages}
            onClick={() => load(query, status, role, pageNumber + 1)}
            className="rounded-md border border-slate-300 px-3 py-2 disabled:opacity-50"
          >
            →
          </button>
        </nav>
      ) : null}
    </div>
  );
}
