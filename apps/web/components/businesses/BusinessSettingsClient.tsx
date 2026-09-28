'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  getManagedBusiness,
  requestErrorMessage,
} from '../../lib/business-management';
import type { ManagedBusiness } from '../../lib/business-management';
export function BusinessSettingsClient({ businessId }: { businessId: string }) {
  const t = useTranslations('businessPortal');
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
          setError(requestErrorMessage(reason, t('loadSettingsError')));
      });
    return () => {
      active = false;
    };
  }, [businessId, t]);
  return (
    <main className="bg-slate-50">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <Link
          href={`/businesses/manage/${businessId}`}
          className="text-sm font-semibold text-highland"
        >
          {t('backToWorkspace')}
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-slate-950">
          {t('settings')}
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
            {t('loadingSettings')}
          </p>
        ) : (
          <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-semibold text-slate-700">
                  {t('businessStatus')}
                </dt>
                <dd className="mt-1 text-slate-950">{business.status}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-700">
                  {t('verification')}
                </dt>
                <dd className="mt-1 text-slate-950">
                  {business.verificationSummary.replaceAll('_', ' ')}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-700">
                  {t('workspaceRole')}
                </dt>
                <dd className="mt-1 text-slate-950">
                  {business.currentMember.role}
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-700">{t('contact')}</dt>
                <dd className="mt-1 text-slate-950">
                  {business.phone ?? business.email ?? t('notSet')}
                </dd>
              </div>
            </dl>
            <p className="mt-6 text-sm leading-6 text-slate-600">
              {t('settingsDescription')}
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
