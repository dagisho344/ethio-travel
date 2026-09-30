'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { AdminUserStatusDialog } from '../../../../components/admin/AdminUserStatusDialog';
import { resolveLocale } from '../../../../i18n/config';
import { formatLocaleDate } from '../../../../i18n/format';
import {
  AdminUserDetail,
  adminFetch,
  displayName,
  statusClass,
} from '../../../../lib/admin';

export function AdminUserDetailClient({
  userId,
  currentUserId,
}: {
  userId: string;
  currentUserId: string;
}) {
  const t = useTranslations('adminUsers');
  const locale = resolveLocale(useLocale());
  const [user, setUser] = useState<AdminUserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    setError(null);
    void adminFetch<AdminUserDetail>(`/api/admin/users/${userId}`)
      .then(setUser)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : t('loadError')),
      );
  }, [userId, t]);
  useEffect(() => {
    load();
  }, [load]);

  if (error)
    return (
      <div role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
        {error}{' '}
        <button
          type="button"
          onClick={load}
          className="ml-2 underline focus:outline-none focus:ring-2 focus:ring-emerald-600"
        >
          {t('retry')}
        </button>
      </div>
    );
  if (!user)
    return (
      <p aria-live="polite" className="text-slate-600">
        {t('loading')}
      </p>
    );

  const statusLabel =
    user.status === 'ACTIVE'
      ? t('statusActive')
      : user.status === 'SUSPENDED'
        ? t('statusSuspended')
        : user.status === 'DEACTIVATED'
          ? t('statusDeactivated')
          : user.status;
  const roleLabel = (value: string) =>
    value === 'TRAVELER'
      ? t('roleTraveler')
      : value === 'BUSINESS_OWNER'
        ? t('roleBusinessOwner')
        : value === 'BUSINESS_STAFF'
          ? t('roleBusinessStaff')
          : value === 'ADMIN'
            ? t('roleAdmin')
            : value;
  const membershipRoleLabel = (value: string) =>
    value === 'OWNER'
      ? t('membershipRoleOwner')
      : value === 'MANAGER'
        ? t('membershipRoleManager')
        : value === 'STAFF'
          ? t('membershipRoleStaff')
          : value;
  const membershipStatusLabel = (value: string) =>
    value === 'ACTIVE'
      ? t('statusActive')
      : value === 'INACTIVE'
        ? t('membershipInactive')
        : value === 'REMOVED'
          ? t('membershipRemoved')
          : value;
  const businessStatusLabel = (value: string) =>
    value === 'ACTIVE'
      ? t('statusActive')
      : value === 'DRAFT'
        ? t('businessDraft')
        : value === 'SUSPENDED'
          ? t('businessSuspended')
          : value === 'ARCHIVED'
            ? t('businessArchived')
            : value;
  const isSelf = user.id === currentUserId;
  const actions =
    user.status === 'ACTIVE'
      ? (['suspend', 'deactivate'] as const)
      : user.status === 'SUSPENDED'
        ? (['restore', 'deactivate'] as const)
        : (['reactivate'] as const);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/admin/users"
        className="text-sm font-semibold text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
      >
        ← {t('backToUsers')}
      </Link>
      <header className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
              {t('userProfile')}
            </p>
            <h1 className="mt-1 break-words text-2xl font-bold text-slate-950">
              {displayName(user)}
            </h1>
            <p className="mt-1 break-all text-slate-600">{user.email}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${statusClass(user.status)}`}
            >
              {statusLabel}
            </span>
            <Link
              href={`/admin/users/${user.id}/edit`}
              className="min-h-10 rounded-md border border-emerald-700 px-3 py-2 text-sm font-semibold text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              {t('editUser')}
            </Link>
          </div>
        </div>
      </header>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold text-slate-950">
          {t('accountInformation')}
        </h2>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">{t('firstName')}</dt>
            <dd className="break-words font-semibold">
              {user.firstName || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">{t('lastName')}</dt>
            <dd className="break-words font-semibold">
              {user.lastName || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">{t('email')}</dt>
            <dd className="break-all font-semibold">{user.email}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{t('phone')}</dt>
            <dd className="font-semibold">{user.phone || '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">{t('roles')}</dt>
            <dd className="font-semibold">
              {user.roles.map(roleLabel).join(', ') || '—'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">{t('emailVerified')}</dt>
            <dd className="font-semibold">
              {user.emailVerifiedAt ? t('emailVerified') : t('notVerified')}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">{t('created')}</dt>
            <dd className="font-semibold">
              {formatLocaleDate(user.createdAt, locale)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">{t('updated')}</dt>
            <dd className="font-semibold">
              {formatLocaleDate(user.updatedAt, locale)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">{t('lastLogin')}</dt>
            <dd className="font-semibold">
              {user.lastLoginAt
                ? formatLocaleDate(user.lastLoginAt, locale)
                : t('never')}
            </dd>
          </div>
        </dl>
      </section>
      <section>
        <h2 className="mb-3 text-lg font-bold text-slate-950">
          {t('activity')}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {(
            [
              ['bookings', user.bookingCount],
              ['trips', user.tripCount],
              ['reviews', user.reviewCount],
              ['businessMemberships', user.businessMembershipCount],
            ] as const
          ).map(([label, count]) => (
            <div
              key={label}
              className="rounded-xl border border-slate-200 bg-white p-4"
            >
              <p className="text-sm text-slate-500">{t(label)}</p>
              <p className="mt-1 text-2xl font-bold">{count}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold text-slate-950">
          {t('businessMemberships')}
        </h2>
        <ul className="mt-3 divide-y divide-slate-100">
          {user.businessMemberships.map((membership) => (
            <li
              key={`${membership.business.id}-${membership.role}`}
              className="py-3"
            >
              <Link
                href={`/admin/businesses/${membership.business.id}`}
                className="font-semibold text-slate-950 hover:text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                {membership.business.name}
              </Link>
              <p className="mt-1 text-sm text-slate-600">
                {membershipRoleLabel(membership.role)} ·{' '}
                {membershipStatusLabel(membership.status)} ·{' '}
                {businessStatusLabel(membership.business.status)}
              </p>
            </li>
          ))}
          {!user.businessMemberships.length ? (
            <li className="py-3 text-sm text-slate-500">
              {t('noMemberships')}
            </li>
          ) : null}
        </ul>
      </section>
      {!isSelf ? (
        <section
          aria-label={t('userProfile')}
          className="flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-white p-5"
        >
          {actions.map((action) => (
            <AdminUserStatusDialog
              key={action}
              action={action}
              userId={user.id}
              name={displayName(user)}
              onComplete={load}
            />
          ))}
        </section>
      ) : null}
    </div>
  );
}
