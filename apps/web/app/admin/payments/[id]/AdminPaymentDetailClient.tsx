'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PaymentSummary } from '../../../../components/payments/PaymentSummary';
import { RefundForm } from '../../../../components/payments/RefundForm';
import type { AdminPayment } from '../../../../lib/admin';

export function AdminPaymentDetailClient() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ id: string }>();
  const [payment, setPayment] = useState<AdminPayment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/payments/${params.id}`, {
        cache: 'no-store',
      });
      if (response.status === 401) {
        router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
        return;
      }
      if (response.status === 403) {
        setError('Only administrators can view this payment.');
        return;
      }
      if (!response.ok) throw new Error('Request failed');
      setPayment((await response.json()) as AdminPayment);
    } catch {
      setError('We could not load this payment right now.');
    } finally {
      setLoading(false);
    }
  }, [params.id, pathname, router]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-5">
      <Link
        href="/admin/payments"
        className="inline-flex items-center gap-2 text-sm font-semibold text-highland hover:text-highland/80 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Payments
      </Link>
      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Loading payment...
        </div>
      ) : null}
      {error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          {error}
        </div>
      ) : null}
      {payment ? (
        <>
          <PaymentSummary
            payment={payment}
            bookingHref={'/admin/bookings/' + payment.bookingId}
          />
          <RefundForm
            payment={payment}
            onRefunded={(updated) =>
              setPayment((current) =>
                current ? { ...updated, auditTrail: current.auditTrail } : null,
              )
            }
          />
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950">
              Relevant audit history
            </h2>
            {payment.auditTrail.length ? (
              <ul className="mt-4 space-y-3 text-sm">
                {payment.auditTrail.map((entry) => (
                  <li key={entry.id} className="rounded-md bg-slate-50 p-3">
                    <p className="font-semibold text-slate-900">
                      {entry.action}
                    </p>
                    <p className="mt-1 text-slate-600">
                      {entry.reason ?? 'No reason recorded.'}
                    </p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-4 text-sm text-slate-600">
                No administrator audit actions relate to this payment.
              </p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
