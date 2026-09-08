'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { PaymentSummary } from '../../../../../components/payments/PaymentSummary';
import type { Payment } from '../../../../../lib/types';

export function BusinessPaymentDetailClient() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ businessId: string; paymentId: string }>();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(
          `/api/businesses/${params.businessId}/payments/${params.paymentId}`,
          { cache: 'no-store' },
        );
        if (response.status === 401) {
          router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
          return;
        }
        if (response.status === 403) {
          setError('You do not have access to this business payment.');
          return;
        }
        if (!response.ok) throw new Error('Request failed');
        setPayment((await response.json()) as Payment);
      } catch {
        setError('We could not load this payment right now.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [params.businessId, params.paymentId, pathname, router]);

  return (
    <div className="space-y-5">
      <Link
        href={`/businesses/${params.businessId}/payments`}
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
      {payment ? <PaymentSummary payment={payment} /> : null}
    </div>
  );
}
