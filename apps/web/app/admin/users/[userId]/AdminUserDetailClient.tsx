'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminActionDialog } from '../../../../components/admin/AdminActionDialog';
import {
  AdminUser,
  adminFetch,
  displayName,
  formatDate,
  statusClass,
} from '../../../../lib/admin';

type UserDetail = AdminUser & {
  bookingCount: number;
  businessMemberships: Array<{
    business: {
      id: string;
      name: string;
      status: string;
      verificationSummary: string;
    };
    createdAt: string;
    role: string;
    status: string;
  }>;
  reviewCount: number;
  tripCount: number;
};

export function AdminUserDetailClient({ userId }: { userId: string }) {
  const [user, setUser] = useState<UserDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => {
    setError(null);
    void adminFetch<UserDetail>(`/api/admin/users/${userId}`)
      .then(setUser)
      .catch((cause: unknown) =>
        setError(cause instanceof Error ? cause.message : 'User unavailable.'),
      );
  };
  useEffect(load, [userId]);
  if (error)
    return (
      <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
        {error}
      </p>
    );
  if (!user) return <p className="text-slate-600">Loading user…</p>;
  const action =
    user.status === 'SUSPENDED'
      ? 'Restore'
      : user.status === 'ACTIVE'
        ? 'Suspend'
        : null;
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/admin/users"
        className="text-sm font-semibold text-emerald-800"
      >
        ← All users
      </Link>
      <header className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">
              {displayName(user)}
            </h1>
            <p className="mt-1 text-slate-600">{user.email}</p>
            <p className="mt-2 text-sm text-slate-500">
              Created {formatDate(user.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${statusClass(user.status)}`}
            >
              {user.status}
            </span>
            {action ? (
              <AdminActionDialog
                action={action}
                endpoint={`/api/admin/users/${user.id}/${action.toLowerCase()}`}
                target={displayName(user)}
                onComplete={load}
              />
            ) : null}
          </div>
        </div>
      </header>
      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Bookings</p>
          <p className="mt-1 text-2xl font-bold">{user.bookingCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Trips</p>
          <p className="mt-1 text-2xl font-bold">{user.tripCount}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm text-slate-500">Reviews</p>
          <p className="mt-1 text-2xl font-bold">{user.reviewCount}</p>
        </div>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold text-slate-950">
          Business memberships
        </h2>
        <ul className="mt-3 divide-y divide-slate-100">
          {user.businessMemberships.map((membership) => (
            <li
              key={`${membership.business.id}-${membership.role}`}
              className="py-3"
            >
              <Link
                href={`/admin/businesses/${membership.business.id}`}
                className="font-semibold text-slate-950 hover:text-emerald-800"
              >
                {membership.business.name}
              </Link>
              <p className="mt-1 text-sm text-slate-600">
                {membership.role} · {membership.status} ·{' '}
                {membership.business.status}
              </p>
            </li>
          ))}
          {!user.businessMemberships.length ? (
            <li className="py-3 text-sm text-slate-500">
              No business memberships.
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
