'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  useParams,
  usePathname,
  useRouter,
  useSearchParams,
} from 'next/navigation';
import { ArrowRight, CreditCard } from 'lucide-react';
import { PaymentStatusBadge } from '../../../../components/bookings/BookingStatusBadge';
import { formatMoney } from '../../../../lib/bookings';
import {
  formatPaymentDate,
  paymentProviderLabel,
  paymentProviderOptions,
  paymentStatusOptions,
} from '../../../../lib/payments';
import type {
  PaymentListResponse,
  PaymentProvider,
  PaymentStatus,
} from '../../../../lib/types';

export function BusinessPaymentsClient() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ businessId: string }>();
  const searchParams = useSearchParams();
  const [page, setPage] = useState<PaymentListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const status = searchParams.get('status') as PaymentStatus | null;
  const provider = searchParams.get('provider') as PaymentProvider | null;
  const currentPage = searchParams.get('page') ?? '1';

  const query = useMemo(() => {
    const next = new URLSearchParams({ page: currentPage, limit: '10' });
    if (status) next.set('status', status);
    if (provider) next.set('provider', provider);
    return next.toString();
  }, [currentPage, provider, status]);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/businesses/${params.businessId}/payments?${query}`,
          { cache: 'no-store' },
        );
        if (response.status === 401) {
          router.replace(
            `/login?returnTo=${encodeURIComponent(`${pathname}?${query}`)}`,
          );
          return;
        }
        if (response.status === 403) {
          setPage(null);
          setError('You do not have access to these business payments.');
          return;
        }
        if (!response.ok) throw new Error('Request failed');
        setPage((await response.json()) as PaymentListResponse);
      } catch {
        setPage(null);
        setError('We could not load business payments right now.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [params.businessId, pathname, query, router]);

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
      <div className="mb-6 grid gap-4 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-3">
        <label className="text-sm font-semibold text-slate-700">
          Payment status
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
          Provider
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
        <div className="flex items-end">
          <Link
            href={`/businesses/${params.businessId}/bookings`}
            className="inline-flex rounded-md border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-highland hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
          >
            View bookings
          </Link>
        </div>
      </div>

      {error ? (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          {error}
        </div>
      ) : null}
      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Loading business payments...
        </div>
      ) : page?.data.length ? (
        <>
          <div className="mb-4 flex items-center justify-between gap-4 text-sm text-slate-600">
            <p>
              {page.meta.total} payment{page.meta.total === 1 ? '' : 's'}
            </p>
            <p>
              Page {page.meta.page} of {Math.max(page.meta.totalPages, 1)}
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
                      {payment.booking.service.name}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {paymentProviderLabel(payment.provider)} �{' '}
                      {formatPaymentDate(payment.createdAt)}
                    </p>
                  </div>
                  <PaymentStatusBadge status={payment.status} />
                </div>
                <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="font-semibold text-slate-700">Amount</dt>
                    <dd className="mt-1 text-slate-600">
                      {formatMoney(payment.amount, payment.currency)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-700">Paid</dt>
                    <dd className="mt-1 text-slate-600">
                      {formatPaymentDate(payment.paidAt)}
                    </dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-slate-700">
                      Provider reference
                    </dt>
                    <dd className="mt-1 break-all text-slate-600">
                      {payment.providerPaymentId ?? 'Pending'}
                    </dd>
                  </div>
                </dl>
                <Link
                  href={`/businesses/${params.businessId}/payments/${payment.id}`}
                  className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-highland hover:text-highland/80 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
                >
                  View payment{' '}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-highland">
            <CreditCard className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-slate-950">
            No payments yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
            Booking payments for this business will appear here.
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
            Previous
          </button>
          <button
            type="button"
            disabled={page.meta.page >= page.meta.totalPages}
            onClick={() => update({ page: String(page.meta.page + 1) })}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
