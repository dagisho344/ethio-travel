'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { canTravelerCancel } from '../../../lib/bookings';
import { formatLocaleDate, formatLocaleMoney } from '../../../i18n/format';
import { resolveLocale } from '../../../i18n/config';
import type { Booking } from '../../../lib/types';
import {
  BookingStatusBadge,
  PaymentStatusBadge,
} from '../../../components/bookings/BookingStatusBadge';
import { PaymentActionPanel } from '../../../components/payments/PaymentActionPanel';
import { StartConversationButton } from '../../../components/messaging/StartConversationButton';

function bookingStatusKey(status: Booking['bookingStatus']) {
  return (
    {
      PENDING: 'pending',
      CONFIRMED: 'confirmed',
      REJECTED: 'rejected',
      CANCELLED_BY_TRAVELER: 'cancelledByTraveler',
      CANCELLED_BY_BUSINESS: 'cancelledByBusiness',
      COMPLETED: 'completed',
      NO_SHOW: 'noShow',
    } as const
  )[status];
}

export function BookingDetailClient() {
  const t = useTranslations('bookings');
  const locale = resolveLocale(useLocale());
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams<{ id: string }>();
  const [booking, setBooking] = useState<Booking | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadBooking = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/bookings/${params.id}`, {
        cache: 'no-store',
      });
      if (response.status === 401) {
        router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
        return;
      }
      if (!response.ok) throw new Error('Request failed');
      setBooking((await response.json()) as Booking);
    } catch {
      setError(t('detailLoadError'));
    } finally {
      setLoading(false);
    }
  }, [params.id, pathname, router, t]);

  useEffect(() => {
    void loadBooking();
  }, [loadBooking]);

  async function cancelBooking() {
    if (!booking || !window.confirm(t('cancelConfirm'))) return;
    setWorking(true);
    setError(null);
    try {
      const response = await fetch(`/api/bookings/${booking.id}/cancel`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ reason: 'Cancelled by traveler' }),
      });
      if (response.status === 401) {
        router.replace(`/login?returnTo=${encodeURIComponent(pathname)}`);
        return;
      }
      if (response.status === 409) {
        setError(t('cancelUnavailable'));
        return;
      }
      if (!response.ok) throw new Error('Request failed');
      setBooking((await response.json()) as Booking);
      router.refresh();
    } catch {
      setError(t('cancelError'));
    } finally {
      setWorking(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
        {t('loading')}
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
        {error ?? t('notFound')}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <Link
        href="/bookings"
        className="inline-flex items-center gap-2 text-sm font-semibold text-highland hover:text-highland/80 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t('backToBookings')}
      </Link>
      {error ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          {error}
        </div>
      ) : null}
      <article className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase text-slate-500">
              {booking.reference}
            </p>
            <h1 className="mt-2 text-2xl font-bold text-slate-950">
              {booking.service.name}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {booking.business.name}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <BookingStatusBadge status={booking.bookingStatus} />
            <PaymentStatusBadge status={booking.paymentStatus} />
          </div>
        </div>
        <dl className="mt-6 grid gap-4 text-sm md:grid-cols-2">
          <div>
            <dt className="font-semibold text-slate-700">{t('dateAndTime')}</dt>
            <dd className="mt-1 text-slate-600">
              {formatLocaleDate(booking.startAt, locale, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}{' '}
              –{' '}
              {formatLocaleDate(booking.endAt, locale, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-700">{t('mode')}</dt>
            <dd className="mt-1 text-slate-600">
              {t(
                (
                  {
                    DATE: 'dateBooking',
                    DATE_RANGE: 'dateRangeBooking',
                    TIME_SLOT: 'timeSlotBooking',
                  } as const
                )[booking.bookingModeSnapshot],
              )}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-700">{t('quantity')}</dt>
            <dd className="mt-1 text-slate-600">{booking.quantity}</dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-700">{t('unitPrice')}</dt>
            <dd className="mt-1 text-slate-600">
              {booking.unitPrice === null || !booking.currency
                ? String(booking.unitPrice ?? '')
                : formatLocaleMoney(
                    String(booking.unitPrice),
                    booking.currency,
                    locale,
                  )}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-700">{t('total')}</dt>
            <dd className="mt-1 text-slate-600">
              {booking.currency
                ? formatLocaleMoney(
                    String(booking.subtotal),
                    booking.currency,
                    locale,
                  )
                : String(booking.subtotal)}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-700">{t('created')}</dt>
            <dd className="mt-1 text-slate-600">
              {formatLocaleDate(booking.createdAt, locale, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })}
            </dd>
          </div>
        </dl>
        {booking.travelerNote ? (
          <p className="mt-5 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
            {booking.travelerNote}
          </p>
        ) : null}
        <div className="mt-6 flex flex-wrap gap-3">
          <StartConversationButton
            businessId={booking.business.id}
            bookingId={booking.id}
            subject={`Booking ${booking.reference}`}
          />
          {canTravelerCancel(booking.bookingStatus) ? (
            <button
              type="button"
              disabled={working}
              onClick={() => void cancelBooking()}
              className="mt-6 inline-flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {working ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              {t('cancel')}
            </button>
          ) : null}
        </div>
      </article>
      <PaymentActionPanel booking={booking} onPaymentChange={loadBooking} />
      {booking.history.length ? (
        <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">
            {t('statusHistory')}
          </h2>
          <ol className="mt-4 space-y-3">
            {booking.history.map((item) => (
              <li
                key={item.id}
                className="border-l-2 border-slate-200 pl-4 text-sm"
              >
                <p className="font-semibold text-slate-900">
                  {t(bookingStatusKey(item.toStatus))}
                </p>
                <p className="text-slate-500">
                  {formatLocaleDate(item.createdAt, locale, {
                    dateStyle: 'medium',
                    timeStyle: 'short',
                  })}
                </p>
                {item.note ? (
                  <p className="mt-1 text-slate-600">{item.note}</p>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}
    </div>
  );
}
