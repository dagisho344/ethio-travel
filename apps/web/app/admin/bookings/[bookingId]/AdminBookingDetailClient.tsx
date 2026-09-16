'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import {
  BookingStatusBadge,
  PaymentStatusBadge,
} from '../../../../components/bookings/BookingStatusBadge';
import { formatBookingDate, formatMoney } from '../../../../lib/bookings';
import type { AdminBooking } from '../../../../lib/admin';
import type { PaymentStatus } from '../../../../lib/types';

function travelerName(booking: AdminBooking): string {
  const profile = booking.traveler.profile;
  return (
    [profile?.firstName, profile?.lastName].filter(Boolean).join(' ') ||
    'Traveler'
  );
}

function Section({
  children,
  title,
}: {
  children: React.ReactNode;
  title: string;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-slate-950">{title}</h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function AdminBookingDetailClient() {
  const params = useParams<{ bookingId: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const [booking, setBooking] = useState<AdminBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/bookings/' + params.bookingId, {
        cache: 'no-store',
      });
      if (response.status === 401) {
        router.replace('/login?returnTo=' + encodeURIComponent(pathname));
        return;
      }
      if (response.status === 403) {
        setError('Only administrators can inspect this booking.');
        return;
      }
      if (response.status === 404) {
        setError('Booking not found.');
        return;
      }
      if (!response.ok) throw new Error('Request failed');
      setBooking((await response.json()) as AdminBooking);
    } catch {
      setError('We could not load this booking right now.');
    } finally {
      setLoading(false);
    }
  }, [params.bookingId, pathname, router]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link
        href="/admin/bookings"
        className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-800 hover:text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
      >
        <ArrowLeft className="h-4 w-4" /> Bookings
      </Link>
      {loading ? <p className="text-slate-600">Loading booking…</p> : null}
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
          {error}
        </p>
      ) : null}
      {booking ? (
        <>
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
                Booking {booking.reference}
              </p>
              <h1 className="mt-1 text-3xl font-bold text-slate-950">
                {booking.service.name}
              </h1>
              <p className="mt-2 text-slate-600">{booking.business.name}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <BookingStatusBadge status={booking.bookingStatus} />
              <PaymentStatusBadge status={booking.paymentStatus} />
            </div>
          </header>
          <div className="grid gap-5 lg:grid-cols-2">
            <Section title="Booking summary">
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="font-semibold text-slate-700">Reference</dt>
                  <dd>{booking.reference}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-700">Traveler</dt>
                  <dd>{travelerName(booking)}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-700">Quantity</dt>
                  <dd>{booking.quantity}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-700">Guests</dt>
                  <dd>{booking.guestCount ?? '—'}</dd>
                </div>
              </dl>
            </Section>
            <Section title="Schedule and pricing">
              <dl className="grid gap-3 text-sm">
                <div>
                  <dt className="font-semibold text-slate-700">Starts</dt>
                  <dd>{formatBookingDate(booking.startAt)}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-700">Ends</dt>
                  <dd>{formatBookingDate(booking.endAt)}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-slate-700">Subtotal</dt>
                  <dd>{formatMoney(booking.subtotal, booking.currency)}</dd>
                </div>
              </dl>
            </Section>
          </div>
          <Section title="Related payments">
            {booking.payments.length ? (
              <ul className="divide-y divide-slate-100">
                {booking.payments.map((payment) => (
                  <li
                    key={payment.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3"
                  >
                    <div>
                      <Link
                        href={'/admin/payments/' + payment.id}
                        className="font-semibold text-emerald-800 hover:text-emerald-700"
                      >
                        Payment {payment.id.slice(0, 8)}
                      </Link>
                      <p className="mt-1 text-sm text-slate-600">
                        {formatMoney(payment.amount, payment.currency)}
                      </p>
                    </div>
                    <PaymentStatusBadge
                      status={payment.status as PaymentStatus}
                    />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-600">
                No payment attempts are associated with this booking.
              </p>
            )}
          </Section>
          <Section title="Booking lifecycle">
            <ol className="space-y-3">
              {booking.history.map((item) => (
                <li
                  key={item.id}
                  className="border-l-2 border-slate-200 pl-4 text-sm"
                >
                  <p className="font-semibold text-slate-900">
                    {item.toStatus}
                  </p>
                  <p className="text-slate-600">
                    {item.note ?? 'No note provided.'} ·{' '}
                    {formatBookingDate(item.createdAt)}
                  </p>
                </li>
              ))}
            </ol>
          </Section>
          <Section title="Relevant audit history">
            {booking.auditTrail.length ? (
              <ul className="space-y-3 text-sm">
                {booking.auditTrail.map((entry) => (
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
              <p className="text-sm text-slate-600">
                No administrator audit actions relate to this booking.
              </p>
            )}
          </Section>
        </>
      ) : null}
    </div>
  );
}
