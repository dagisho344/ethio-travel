'use client';

import { useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { formatMoney } from '../../lib/bookings';
import {
  canAdminRefund,
  refundableBalance,
  refundedAmount,
} from '../../lib/payments';
import type { Payment } from '../../lib/types';

export function RefundForm({
  payment,
  onRefunded,
}: {
  payment: Payment;
  onRefunded: (payment: Payment) => void;
}) {
  const [mode, setMode] = useState<'full' | 'partial'>('full');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const remaining = refundableBalance(payment);
  const requestedAmount = mode === 'full' ? remaining : Number(amount);
  const invalidPartial =
    mode === 'partial' &&
    (!Number.isFinite(requestedAmount) ||
      requestedAmount <= 0 ||
      requestedAmount > remaining);

  async function submit() {
    if (!canAdminRefund(payment) || working || invalidPartial) return;
    if (
      !window.confirm(
        `Refund ${formatMoney(requestedAmount, payment.currency)}?`,
      )
    )
      return;
    setWorking(true);
    setError(null);
    setMessage(null);
    try {
      const idempotencyKey = crypto.randomUUID();
      const response = await fetch(`/api/admin/payments/${payment.id}/refund`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': idempotencyKey,
        },
        body: JSON.stringify({
          amount: requestedAmount,
          reason,
          idempotencyKey,
        }),
      });
      if (response.status === 401) {
        setError('Please sign in as an administrator to refund payments.');
        return;
      }
      if (response.status === 403) {
        setError('Only administrators can refund payments.');
        return;
      }
      if (response.status === 409) {
        setError('This payment can no longer be refunded for that amount.');
        return;
      }
      if (!response.ok) throw new Error('Request failed');
      const updated = (await response.json()) as Payment;
      onRefunded(updated);
      setMessage('Refund request completed with the provider response.');
      setAmount('');
      setReason('');
    } catch {
      setError('We could not complete this refund right now.');
    } finally {
      setWorking(false);
    }
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <RotateCcw className="h-5 w-5 text-highland" aria-hidden="true" />
        <h2 className="text-lg font-bold text-slate-950">Refund payment</h2>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="font-semibold text-slate-700">Original amount</dt>
          <dd className="mt-1 text-slate-600">
            {formatMoney(payment.amount, payment.currency)}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-700">Refunded</dt>
          <dd className="mt-1 text-slate-600">
            {formatMoney(refundedAmount(payment), payment.currency)}
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-700">Remaining</dt>
          <dd className="mt-1 text-slate-600">
            {formatMoney(remaining, payment.currency)}
          </dd>
        </div>
      </dl>

      {canAdminRefund(payment) ? (
        <div className="mt-5 grid gap-4 md:grid-cols-[12rem_1fr_1fr_auto] md:items-end">
          <label className="text-sm font-semibold text-slate-700">
            Refund type
            <select
              value={mode}
              onChange={(event) =>
                setMode(event.target.value === 'partial' ? 'partial' : 'full')
              }
              className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none focus:border-highland focus:ring-2 focus:ring-highland/20"
            >
              <option value="full">Full refund</option>
              <option value="partial">Partial refund</option>
            </select>
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Amount
            <input
              type="number"
              min="0.01"
              step="0.01"
              value={mode === 'full' ? remaining.toFixed(2) : amount}
              disabled={mode === 'full'}
              onChange={(event) => setAmount(event.target.value)}
              className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none focus:border-highland focus:ring-2 focus:ring-highland/20 disabled:bg-slate-100"
            />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Reason
            <input
              value={reason}
              maxLength={500}
              onChange={(event) => setReason(event.target.value)}
              className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none focus:border-highland focus:ring-2 focus:ring-highland/20"
            />
          </label>
          <button
            type="button"
            disabled={working || invalidPartial}
            onClick={() => void submit()}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-highland px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {working ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : null}
            Refund
          </button>
        </div>
      ) : (
        <p className="mt-4 rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
          This payment has no refundable balance in its current state.
        </p>
      )}

      {invalidPartial ? (
        <p className="mt-3 text-sm text-red-700">
          Enter an amount greater than zero and no more than the remaining
          refundable balance.
        </p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-red-700">{error}</p> : null}
      {message ? (
        <p className="mt-3 text-sm text-emerald-700">{message}</p>
      ) : null}
    </section>
  );
}
