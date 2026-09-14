'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { AdminActionDialog } from '../../../../components/admin/AdminActionDialog';
import { adminFetch, statusClass } from '../../../../lib/admin';

type BusinessDetail = {
  business: {
    category: string;
    city: string;
    createdAt: string;
    description: string;
    destination: string | null;
    id: string;
    name: string;
    status: string;
    verificationSummary: string;
  };
  counts: {
    bookings: number;
    payments: number;
    reviews: number;
    services: number;
  };
  locations: Array<{
    addressLine1: string;
    city: string;
    destination: string | null;
    id: string;
    isPrimary: boolean;
    label: string;
    status: string;
    timezone: string;
  }>;
  media: { publicReadyCount: number; total: number };
  members: Array<{
    role: string;
    status: string;
    user: {
      email: string;
      firstName: string | null;
      id: string;
      lastName: string | null;
    };
  }>;
  services: Array<{ id: string; name: string; status: string }>;
  verifications: Array<{
    createdAt: string;
    documentCount: number;
    id: string;
    rejectionReason: string | null;
    reviewedAt: string | null;
    status: string;
    submittedAt: string | null;
  }>;
};
function nameOf(user: BusinessDetail['members'][number]['user']) {
  return (
    [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
  );
}
export function AdminBusinessDetailClient({
  businessId,
}: {
  businessId: string;
}) {
  const [detail, setDetail] = useState<BusinessDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = () => {
    setError(null);
    void adminFetch<BusinessDetail>(`/api/admin/businesses/${businessId}`)
      .then(setDetail)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error ? cause.message : 'Business unavailable.',
        ),
      );
  };
  useEffect(load, [businessId]);
  if (error)
    return (
      <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
        {error}
      </p>
    );
  if (!detail) return <p className="text-slate-600">Loading business…</p>;
  const business = detail.business;
  const action =
    business.status === 'SUSPENDED'
      ? 'Restore'
      : business.status === 'ACTIVE' || business.status === 'DRAFT'
        ? 'Suspend'
        : null;
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link
        href="/admin/businesses"
        className="text-sm font-semibold text-emerald-800"
      >
        ← All businesses
      </Link>
      <header className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">
              {business.name}
            </h1>
            <p className="mt-1 text-slate-600">
              {business.category} · {business.destination ?? business.city}
            </p>
            <p className="mt-3 max-w-3xl text-sm text-slate-600">
              {business.description}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${statusClass(business.status)}`}
            >
              {business.status}
            </span>
            <span
              className={`rounded-md px-2.5 py-1 text-xs font-semibold ${statusClass(business.verificationSummary)}`}
            >
              {business.verificationSummary}
            </span>
            {action ? (
              <AdminActionDialog
                action={action}
                endpoint={`/api/admin/businesses/${business.id}/${action.toLowerCase()}`}
                target={business.name}
                onComplete={load}
              />
            ) : null}
          </div>
        </div>
      </header>
      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Object.entries(detail.counts).map(([label, value]) => (
          <div
            key={label}
            className="rounded-xl border border-slate-200 bg-white p-4"
          >
            <p className="capitalize text-sm text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-950">{value}</p>
          </div>
        ))}
      </section>
      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold">Members</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {detail.members.map((member) => (
              <li key={member.user.id} className="py-3">
                <p className="font-semibold text-slate-900">
                  {nameOf(member.user)}
                </p>
                <p className="text-sm text-slate-600">
                  {member.role} · {member.status}
                </p>
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-bold">Locations</h2>
          <ul className="mt-3 divide-y divide-slate-100">
            {detail.locations.map((location) => (
              <li key={location.id} className="py-3">
                <p className="font-semibold text-slate-900">
                  {location.label}
                  {location.isPrimary ? ' · Primary' : ''}
                </p>
                <p className="text-sm text-slate-600">
                  {location.addressLine1},{' '}
                  {location.destination ?? location.city}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-bold">Verification history</h2>
        <ul className="mt-3 divide-y divide-slate-100">
          {detail.verifications.map((verification) => (
            <li key={verification.id} className="py-3">
              <Link
                href={`/admin/verifications/${verification.id}`}
                className="font-semibold text-slate-900 hover:text-emerald-800"
              >
                {verification.status}
              </Link>
              <p className="mt-1 text-sm text-slate-600">
                {verification.documentCount} document record(s)
                {verification.rejectionReason
                  ? ' · Rejection reason recorded'
                  : ''}
              </p>
            </li>
          ))}
          {!detail.verifications.length ? (
            <li className="py-3 text-sm text-slate-500">
              No verification history.
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}
