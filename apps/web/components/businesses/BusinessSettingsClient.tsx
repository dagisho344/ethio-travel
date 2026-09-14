'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  getManagedBusiness,
  requestErrorMessage,
} from '../../lib/business-management';
import type { ManagedBusiness } from '../../lib/business-management';
export function BusinessSettingsClient({ businessId }: { businessId: string }) {
  const [business, setBusiness] = useState<ManagedBusiness | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void getManagedBusiness(businessId)
      .then((value) => {
        if (active) setBusiness(value);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            requestErrorMessage(
              reason,
              'Business settings could not be loaded.',
            ),
          );
      });
    return () => {
      active = false;
    };
  }, [businessId]);
  return (
    <main className="bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link
          href={`/businesses/manage/${businessId}`}
          className="text-sm font-semibold text-highland"
        >
          Back to workspace
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-slate-950">
          Business settings
        </h1>
        {error ? (
          <p
            role="alert"
            className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            {error}
          </p>
        ) : !business ? (
          <p className="mt-5 rounded-md bg-white p-5 text-sm text-slate-500">
            Loading settings...
          </p>
        ) : (
          <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-semibold text-slate-700">
                  Business status
                </dt>
                <dd className="mt-1 text-slate-950">{business.status}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-700">Verification</dt>
                <dd className="mt-1 text-slate-950">
                  {business.verificationSummary.replaceAll('_', ' ')}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-700">Workspace role</dt>
                <dd className="mt-1 text-slate-950">
                  {business.currentMember.role}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-700">Contact</dt>
                <dd className="mt-1 text-slate-950">
                  {business.phone ?? business.email ?? 'Not set'}
                </dd>
              </div>
            </dl>
            <p className="mt-6 text-sm leading-6 text-slate-600">
              Profile and contact changes use the existing protected workspace
              editor. Business suspension, permanent deletion, billing, and
              payouts are not owner settings.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
