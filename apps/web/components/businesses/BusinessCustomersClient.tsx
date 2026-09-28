'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  getBusinessCustomers,
  operationError,
} from '../../lib/business-operations';
import type { ManagedCustomer } from '../../lib/business-operations';
import { resolveLocale } from '../../i18n/config';
import { formatLocaleDate } from '../../i18n/format';
export function BusinessCustomersClient({
  businessId,
}: {
  businessId: string;
}) {
  const t = useTranslations('businessPortal');
  const locale = resolveLocale(useLocale());
  const [customers, setCustomers] = useState<ManagedCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    void getBusinessCustomers(businessId)
      .then((page) => {
        if (active) setCustomers(page.data);
      })
      .catch((reason: unknown) => {
        if (active) setError(operationError(reason, t('loadCustomersError')));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [businessId, t]);
  return (
    <main className="bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Link
          href={`/businesses/manage/${businessId}`}
          className="text-sm font-semibold text-highland"
        >
          {t('backToWorkspace')}
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-slate-950">
          {t('customers')}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {t('customersDescription')}
        </p>
        {error ? (
          <p
            role="alert"
            className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            {error}
          </p>
        ) : null}
        {loading ? (
          <p className="mt-6 rounded-md bg-white p-5 text-sm text-slate-500">
            {t('loadingCustomers')}
          </p>
        ) : customers.length ? (
          <div className="mt-6 overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3">{t('traveler')}</th>
                  <th className="px-4 py-3">{t('bookings')}</th>
                  <th className="px-4 py-3">{t('upcoming')}</th>
                  <th className="px-4 py-3">{t('completed')}</th>
                  <th className="px-4 py-3">{t('mostRecent')}</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((customer) => (
                  <tr
                    key={customer.userId}
                    className="border-t border-slate-100"
                  >
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {customer.displayName}
                    </td>
                    <td className="px-4 py-3">{customer.bookingCount}</td>
                    <td className="px-4 py-3">
                      {customer.upcomingBookingCount}
                    </td>
                    <td className="px-4 py-3">
                      {customer.completedBookingCount}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {customer.mostRecentBookingAt
                        ? formatLocaleDate(customer.mostRecentBookingAt, locale)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-6 rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
            {t('noCustomers')}
          </p>
        )}
      </div>
    </main>
  );
}
