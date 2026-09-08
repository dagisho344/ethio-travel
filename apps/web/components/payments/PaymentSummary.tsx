import Link from 'next/link';
import { AlertCircle, CreditCard, ReceiptText, RotateCcw } from 'lucide-react';
import { PaymentStatusBadge } from '../bookings/BookingStatusBadge';
import { formatMoney } from '../../lib/bookings';
import {
  formatPaymentDate,
  paymentProviderLabel,
  paymentRefundStatusLabel,
  paymentTransactionStatusLabel,
  paymentTransactionTypeLabel,
  refundableBalance,
  refundedAmount,
} from '../../lib/payments';
import type { Payment } from '../../lib/types';

export function PaymentSummary({
  payment,
  showBookingLink = false,
}: {
  payment: Payment;
  showBookingLink?: boolean;
}) {
  const refunded = refundedAmount(payment);
  const remaining = refundableBalance(payment);

  return (
    <article className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase text-slate-500">
            Payment reference
          </p>
          <h2 className="mt-1 break-all text-lg font-bold text-slate-950">
            {payment.providerPaymentId ?? payment.id}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {payment.booking.reference} � {payment.booking.service.name}
          </p>
        </div>
        <PaymentStatusBadge status={payment.status} />
      </div>

      {payment.provider === 'DEVELOPMENT' ? (
        <div className="mt-4 flex gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <p>Development payment provider - no real money is being charged.</p>
        </div>
      ) : null}

      <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <dt className="font-semibold text-slate-700">Amount</dt>
          <dd className="mt-1 text-slate-600">
            {formatMoney(payment.amount, payment.currency)}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-700">Provider</dt>
          <dd className="mt-1 text-slate-600">
            {paymentProviderLabel(payment.provider)}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-700">Created</dt>
          <dd className="mt-1 text-slate-600">
            {formatPaymentDate(payment.createdAt)}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-700">Paid</dt>
          <dd className="mt-1 text-slate-600">
            {formatPaymentDate(payment.paidAt)}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-700">Refunded</dt>
          <dd className="mt-1 text-slate-600">
            {formatMoney(refunded, payment.currency)}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-700">Refundable balance</dt>
          <dd className="mt-1 text-slate-600">
            {formatMoney(remaining, payment.currency)}
          </dd>
        </div>
      </dl>

      {showBookingLink ? (
        <Link
          href={`/bookings/${payment.bookingId}`}
          className="mt-4 inline-flex text-sm font-semibold text-highland hover:text-highland/80 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
        >
          View booking
        </Link>
      ) : null}

      <PaymentTimeline payment={payment} />
    </article>
  );
}

function PaymentTimeline({ payment }: { payment: Payment }) {
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <section className="rounded-md border border-slate-100 bg-slate-50 p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
          <ReceiptText className="h-4 w-4 text-highland" aria-hidden="true" />
          Transactions
        </div>
        {payment.transactions.length ? (
          <ol className="mt-3 space-y-3">
            {payment.transactions.map((transaction) => (
              <li key={transaction.id} className="text-sm text-slate-600">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-slate-800">
                    {paymentTransactionTypeLabel(transaction.type)}
                  </span>
                  <span>
                    {paymentTransactionStatusLabel(transaction.status)}
                  </span>
                </div>
                <div className="mt-1 flex flex-wrap justify-between gap-2 text-xs text-slate-500">
                  <span>
                    {formatMoney(transaction.amount, transaction.currency)}
                  </span>
                  <span>{formatPaymentDate(transaction.createdAt)}</span>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-slate-500">
            No transaction records yet.
          </p>
        )}
      </section>

      <section className="rounded-md border border-slate-100 bg-slate-50 p-4">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-950">
          <RotateCcw className="h-4 w-4 text-highland" aria-hidden="true" />
          Refunds
        </div>
        {payment.refunds.length ? (
          <ol className="mt-3 space-y-3">
            {payment.refunds.map((refund) => (
              <li key={refund.id} className="text-sm text-slate-600">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-slate-800">
                    {formatMoney(refund.amount, refund.currency)}
                  </span>
                  <span>{paymentRefundStatusLabel(refund.status)}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {refund.reason ?? 'No reason recorded'}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  {formatPaymentDate(refund.completedAt ?? refund.createdAt)}
                </p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 text-sm text-slate-500">No refunds recorded.</p>
        )}
      </section>
    </div>
  );
}

export function PaymentEmptyState() {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-6 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-highland">
        <CreditCard className="h-6 w-6" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-base font-semibold text-slate-950">
        No payment attempts yet
      </h2>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
        Payment attempts for this booking will appear here after they are
        started.
      </p>
    </div>
  );
}
