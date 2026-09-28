'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { PaymentStatusBadge } from '../../../components/bookings/BookingStatusBadge';
import {
  paymentProviderLabel,
  paymentProviderOptions,
  paymentStatusOptions,
} from '../../../lib/payments';
import { resolveLocale } from '../../../i18n/config';
import { formatLocaleDate, formatLocaleMoney } from '../../../i18n/format';
import type {
  PaymentListResponse,
  PaymentProvider,
  PaymentStatus,
} from '../../../lib/types';

export function AdminPaymentsClient() {
  const t = useTranslations('adminPortal');
  const locale = resolveLocale(useLocale());
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [page, setPage] = useState<PaymentListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const status = searchParams.get('status') as PaymentStatus | null;
  const provider = searchParams.get('provider') as PaymentProvider | null;
  const bookingId = searchParams.get('bookingId') ?? '';
  const reference = searchParams.get('reference') ?? '';
  const traveler = searchParams.get('traveler') ?? '';
  const business = searchParams.get('business') ?? '';
  const currency = searchParams.get('currency') ?? '';
  const from = searchParams.get('from') ?? '';
  const to = searchParams.get('to') ?? '';
  const currentPage = searchParams.get('page') ?? '1';

  const query = useMemo(() => {
    const next = new URLSearchParams({ page: currentPage, limit: '10' });
    if (status) next.set('status', status);
    if (provider) next.set('provider', provider);
    if (bookingId) next.set('bookingId', bookingId);
    if (reference) next.set('reference', reference);
    if (traveler) next.set('traveler', traveler);
    if (business) next.set('business', business);
    if (currency) next.set('currency', currency);
    if (from) next.set('from', from);
    if (to) next.set('to', to);
    return next.toString();
  }, [
    bookingId,
    business,
    currency,
    currentPage,
    from,
    provider,
    reference,
    status,
    to,
    traveler,
  ]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/admin/payments?${query}`, {
          cache: 'no-store',
        });
        if (response.status === 401) {
          router.replace(
            `/login?returnTo=${encodeURIComponent(`${pathname}?${query}`)}`,
          );
          return;
        }
        if (response.status === 403) {
          setPage(null);
          setError(t('adminPaymentsDenied'));
          return;
        }
        if (!response.ok) throw new Error('Request failed');
        setPage((await response.json()) as PaymentListResponse);
      } catch {
        setPage(null);
        setError(t('loadPaymentsError'));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [pathname, query, router, t]);

  function update(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) next.set(key, value);
      else next.delete(key);
    });
    router.push(next.toString() ? `${pathname}?${next}` : pathname);
  }

  return (
    <div>
      <header className="mb-6">
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
          {t('operations')}
        </p>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">
          {t('paymentInvestigation')}
        </h1>
        <p className="mt-2 text-slate-600">
          {t('paymentInvestigationDescription')}
        </p>
      </header>
      <div className="mb-6 grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm font-semibold text-slate-700">
          {t('paymentStatus')}
          <select
            value={status ?? ''}
            onChange={(event) =>
              update({ status: event.target.value || null, page: null })
            }
            className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none focus:border-highland focus:ring-2 focus:ring-highland/20"
          >
            {paymentStatusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          {t('provider')}
          <select
            value={provider ?? ''}
            onChange={(event) =>
              update({ provider: event.target.value || null, page: null })
            }
            className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none focus:border-highland focus:ring-2 focus:ring-highland/20"
          >
            {paymentProviderOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          {t('bookingReference')}
          <input
            value={reference}
            onChange={(event) =>
              update({
                reference: event.target.value.trim() || null,
                page: null,
              })
            }
            placeholder="ETB-..."
            className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none focus:border-highland focus:ring-2 focus:ring-highland/20"
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          {t('traveler')}
          <input
            value={traveler}
            onChange={(event) =>
              update({
                traveler: event.target.value.trim() || null,
                page: null,
              })
            }
            placeholder="Name or email"
            className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none focus:border-highland focus:ring-2 focus:ring-highland/20"
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          {t('business')}
          <input
            value={business}
            onChange={(event) =>
              update({
                business: event.target.value.trim() || null,
                page: null,
              })
            }
            placeholder="Business name"
            className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none focus:border-highland focus:ring-2 focus:ring-highland/20"
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          {t('currency')}
          <input
            value={currency}
            maxLength={3}
            onChange={(event) =>
              update({
                currency: event.target.value.trim().toUpperCase() || null,
                page: null,
              })
            }
            placeholder="ETB"
            className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none focus:border-highland focus:ring-2 focus:ring-highland/20"
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          {t('createdFrom')}
          <input
            type="date"
            value={from}
            onChange={(event) =>
              update({ from: event.target.value || null, page: null })
            }
            className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none focus:border-highland focus:ring-2 focus:ring-highland/20"
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          {t('createdTo')}
          <input
            type="date"
            value={to}
            onChange={(event) =>
              update({ to: event.target.value || null, page: null })
            }
            className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none focus:border-highland focus:ring-2 focus:ring-highland/20"
          />
        </label>
        <button
          type="button"
          onClick={() =>
            update({
              business: null,
              bookingId: null,
              currency: null,
              from: null,
              page: null,
              provider: null,
              reference: null,
              status: null,
              to: null,
              traveler: null,
            })
          }
          className="rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-highland hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
        >
          {t('clearFilters')}
        </button>
      </div>

      {error ? (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          {error}
        </div>
      ) : null}
      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Loading payments...
        </div>
      ) : page?.data.length ? (
        <>
          <div className="mb-4 flex items-center justify-between gap-4 text-sm text-slate-600">
            <p>{t('paymentsFound', { count: page.meta.total })}</p>
            <p>
              {t('pageOf', {
                page: page.meta.page,
                total: Math.max(page.meta.totalPages, 1),
              })}
            </p>
          </div>
          <div className="space-y-4">
            {page.data.map((payment) => (
              <article
                key={payment.id}
                className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">
                      {payment.booking.reference}
                    </p>
                    <h2 className="mt-1 text-lg font-bold text-slate-950">
                      {payment.booking.business.name}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {payment.booking.service.name} �{' '}
                      {paymentProviderLabel(payment.provider)}
                    </p>
                  </div>
                  <PaymentStatusBadge status={payment.status} />
                </div>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-4">
                  <div>
                    <dt className="font-semibold text-slate-700">
                      {t('amount')}
                    </dt>
                    <dd className="mt-1 text-slate-600">
                      {formatLocaleMoney(
                        String(payment.amount),
                        payment.currency,
                        locale,
                      )}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-700">
                      {t('created')}
                    </dt>
                    <dd className="mt-1 text-slate-600">
                      {formatLocaleDate(payment.createdAt, locale, {
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-700">
                      {t('paidAt')}
                    </dt>
                    <dd className="mt-1 text-slate-600">
                      {payment.paidAt
                        ? formatLocaleDate(payment.paidAt, locale, {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })
                        : t('notRecorded')}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-700">
                      {t('providerReference')}
                    </dt>
                    <dd className="mt-1 break-all text-slate-600">
                      {payment.providerPaymentId ?? t('pending')}
                    </dd>
                  </div>
                </dl>
                <Link
                  href={`/admin/payments/${payment.id}`}
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-highland hover:text-highland/80 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
                >
                  {t('viewPayment')}{' '}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-highland">
            <ShieldCheck className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-slate-950">
            {t('noPayments')}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
            {t('noPaymentsDescription')}
          </p>
        </div>
      )}

      {page && page.meta.totalPages > 1 ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={page.meta.page <= 1}
            onClick={() => update({ page: String(page.meta.page - 1) })}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
          >
            {t('previous')}
          </button>
          <button
            type="button"
            disabled={page.meta.page >= page.meta.totalPages}
            onClick={() => update({ page: String(page.meta.page + 1) })}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
          >
            {t('next')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
