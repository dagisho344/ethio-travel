'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { AlertCircle, CreditCard, ReceiptText, RotateCcw } from 'lucide-react';
import {
  BookingStatusBadge,
  PaymentStatusBadge,
} from '../bookings/BookingStatusBadge';
import { refundableBalance, refundedAmount } from '../../lib/payments';
import type { Payment } from '../../lib/types';
import { formatLocaleDate, formatLocaleMoney } from '../../i18n/format';
import { resolveLocale } from '../../i18n/config';

function formatPaymentAmount(
  amount: string | number,
  currency: string,
  locale: ReturnType<typeof resolveLocale>,
) {
  return formatLocaleMoney(String(amount), currency, locale);
}

function transactionTypeKey(type: Payment['transactions'][number]['type']) {
  return (
    {
      PAYMENT_INITIATED: 'paymentInitiated',
      PROVIDER_AUTHORIZATION: 'providerAuthorization',
      PAYMENT_CAPTURED: 'paymentCaptured',
      PAYMENT_FAILED: 'paymentFailed',
      REFUND_INITIATED: 'refundInitiated',
      REFUND_SUCCEEDED: 'refundSucceeded',
      REFUND_FAILED: 'refundFailed',
    } as const
  )[type];
}

function transactionStatusKey(
  status: Payment['transactions'][number]['status'],
) {
  return (
    {
      PENDING: 'pending',
      SUCCEEDED: 'succeeded',
      FAILED: 'failedStatus',
    } as const
  )[status];
}

export function PaymentSummary({
  payment,
  bookingHref,
  showBookingLink = false,
}: {
  payment: Payment;
  bookingHref?: string;
  showBookingLink?: boolean;
}) {
  const t = useTranslations('payment');
  const locale = resolveLocale(useLocale());
  const refunded = refundedAmount(payment);
  const remaining = refundableBalance(payment);
  const resolvedBookingHref =
    bookingHref ?? (showBookingLink ? '/bookings/' + payment.bookingId : null);

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">
            {t('reference')}
          </p>
          <h2 className="mt-1 break-all text-lg font-bold text-slate-950">
            {payment.providerPaymentId ?? payment.id}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {payment.booking.reference} � {payment.booking.service.name}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('bookingStatus')}
            </p>
            <BookingStatusBadge status={payment.booking.bookingStatus} />
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {t('paymentStatus')}
            </p>
            <PaymentStatusBadge status={payment.status} />
          </div>
        </div>
      </div>

      {payment.provider === 'DEVELOPMENT' ? (
        <div className="mt-4 flex gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>{t('developmentNotice')}</p>
        </div>
      ) : null}

      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="font-semibold text-slate-700">{t('amount')}</dt>
          <dd className="mt-1 text-slate-600">
            {formatPaymentAmount(payment.amount, payment.currency, locale)}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-700">{t('provider')}</dt>
          <dd className="mt-1 text-slate-600">
            {payment.provider === 'DEVELOPMENT'
              ? t('developmentProvider')
              : payment.provider}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-700">{t('created')}</dt>
          <dd className="mt-1 text-slate-600">
            {formatLocaleDate(payment.createdAt, locale, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-700">{t('paid')}</dt>
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
          <dt className="font-semibold text-slate-700">{t('refunded')}</dt>
          <dd className="mt-1 text-slate-600">
            {formatPaymentAmount(refunded, payment.currency, locale)}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-700">
            {t('refundableBalance')}
          </dt>
          <dd className="mt-1 text-slate-600">
            {formatPaymentAmount(remaining, payment.currency, locale)}
          </dd>
        </div>
      </dl>

      {resolvedBookingHref ? (
        <Link
          href={resolvedBookingHref}
          className="mt-4 inline-flex text-sm font-semibold text-highland hover:text-highland/80 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
        >
          {t('viewBooking')}
        </Link>
      ) : null}

      <PaymentTimeline payment={payment} />
    </article>
  );
}

function PaymentTimeline({ payment }: { payment: Payment }) {
  const t = useTranslations('payment');
  const locale = resolveLocale(useLocale());
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <section className="rounded-md border border-slate-100 bg-slate-50 p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
          <ReceiptText className="h-4 w-4 text-highland" aria-hidden="true" />
          {t('transactions')}
        </div>
        {payment.transactions.length ? (
          <ol className="mt-3 space-y-3">
            {payment.transactions.map((transaction) => (
              <li key={transaction.id} className="text-sm text-slate-600">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-slate-800">
                    {t(transactionTypeKey(transaction.type))}
                  </span>
                  <span>{t(transactionStatusKey(transaction.status))}</span>
                </div>
                <div className="mt-1 flex flex-wrap justify-between gap-2 text-xs text-slate-500">
                  <span>
                    {formatPaymentAmount(
                      transaction.amount,
                      transaction.currency,
                      locale,
                    )}
                  </span>
                  <span>
                    {formatLocaleDate(transaction.createdAt, locale, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-slate-500">{t('noTransactions')}</p>
        )}
      </section>

      <section className="rounded-md border border-slate-100 bg-slate-50 p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
          <RotateCcw className="h-4 w-4 text-highland" aria-hidden="true" />
          {t('refunds')}
        </div>
        {payment.refunds.length ? (
          <ol className="mt-3 space-y-3">
            {payment.refunds.map((refund) => (
              <li key={refund.id} className="text-sm text-slate-600">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-slate-800">
                    {formatPaymentAmount(
                      refund.amount,
                      refund.currency,
                      locale,
                    )}
                  </span>
                  <span>{t(transactionStatusKey(refund.status))}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {refund.reason ?? t('noReason')}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatLocaleDate(
                    refund.completedAt ?? refund.createdAt,
                    locale,
                    { dateStyle: 'medium', timeStyle: 'short' },
                  )}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-slate-500">{t('noRefunds')}</p>
        )}
      </section>
    </div>
  );
}

export function PaymentEmptyState() {
  const t = useTranslations('payment');
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-highland">
        <CreditCard className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-base font-semibold text-slate-950">
        {t('noAttempts')}
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
        {t('noAttemptsDescription')}
      </p>
    </div>
  );
}
