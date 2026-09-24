'use client';

import { useMemo, useState } from 'react';
import { LoaderCircle, Pencil, Plus, Trash2 } from 'lucide-react';
import { BffRequestError, bffJson } from '../../lib/private-api';
import type {
  TripBudget,
  TripBudgetCategory,
  TripCostEstimate,
  TripPlannedExpense,
} from '../../lib/types';

const categories: Array<{ value: TripBudgetCategory; label: string }> = [
  { value: 'ACCOMMODATION', label: 'Accommodation' },
  { value: 'TRANSPORT', label: 'Transport' },
  { value: 'FOOD', label: 'Food' },
  { value: 'ACTIVITIES', label: 'Activities' },
  { value: 'OTHER', label: 'Other' },
];

function messageFor(error: unknown, fallback: string): string {
  return error instanceof BffRequestError ? error.message : fallback;
}

type Props = {
  tripId: string;
  budget: TripBudget | null;
  bookingCost: TripCostEstimate | null;
  readOnly: boolean;
  onChanged: () => Promise<void>;
};

export function TripBudgetPlanner({
  tripId,
  budget,
  bookingCost,
  readOnly,
  onChanged,
}: Props) {
  const [amount, setAmount] = useState(budget?.amount ?? '');
  const [currency, setCurrency] = useState(budget?.currency ?? 'ETB');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseCategory, setExpenseCategory] =
    useState<TripBudgetCategory>('OTHER');
  const [expenseNote, setExpenseNote] = useState('');
  const [editing, setEditing] = useState<TripPlannedExpense | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const categoryRows = useMemo(
    () =>
      categories.map((category) => ({
        ...category,
        total: budget?.categoryTotals[category.value] ?? '0',
      })),
    [budget],
  );

  async function saveBudget() {
    setBusy(true);
    setError(null);
    try {
      await bffJson(`/api/trips/${tripId}/budget`, {
        method: 'PUT',
        body: JSON.stringify({ amount, currency }),
      });
      await onChanged();
    } catch (requestError) {
      setError(messageFor(requestError, 'We could not save this budget.'));
    } finally {
      setBusy(false);
    }
  }

  async function removeBudget() {
    if (!window.confirm('Remove this budget and all of its planned expenses?'))
      return;
    setBusy(true);
    setError(null);
    try {
      await bffJson(`/api/trips/${tripId}/budget`, { method: 'DELETE' });
      setAmount('');
      setCurrency('ETB');
      await onChanged();
    } catch (requestError) {
      setError(messageFor(requestError, 'We could not remove this budget.'));
    } finally {
      setBusy(false);
    }
  }

  async function addExpense() {
    setBusy(true);
    setError(null);
    try {
      await bffJson(`/api/trips/${tripId}/budget/expenses`, {
        method: 'POST',
        body: JSON.stringify({
          category: expenseCategory,
          amount: expenseAmount,
          note: expenseNote.trim() || null,
        }),
      });
      setExpenseAmount('');
      setExpenseNote('');
      await onChanged();
    } catch (requestError) {
      setError(
        messageFor(requestError, 'We could not add this planned expense.'),
      );
    } finally {
      setBusy(false);
    }
  }

  async function saveExpense() {
    if (!editing) return;
    setBusy(true);
    setError(null);
    try {
      await bffJson(`/api/trips/${tripId}/budget/expenses/${editing.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          category: expenseCategory,
          amount: expenseAmount,
          note: expenseNote.trim() || null,
        }),
      });
      setEditing(null);
      setExpenseAmount('');
      setExpenseNote('');
      await onChanged();
    } catch (requestError) {
      setError(
        messageFor(requestError, 'We could not update this planned expense.'),
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeExpense(expenseId: string) {
    setBusy(true);
    setError(null);
    try {
      await bffJson(`/api/trips/${tripId}/budget/expenses/${expenseId}`, {
        method: 'DELETE',
      });
      await onChanged();
    } catch (requestError) {
      setError(
        messageFor(requestError, 'We could not remove this planned expense.'),
      );
    } finally {
      setBusy(false);
    }
  }

  function beginEdit(expense: TripPlannedExpense) {
    setEditing(expense);
    setExpenseCategory(expense.category);
    setExpenseAmount(expense.amount);
    setExpenseNote(expense.note ?? '');
  }

  return (
    <section
      className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
      aria-labelledby="trip-budget-heading"
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2
            id="trip-budget-heading"
            className="text-lg font-bold text-slate-950"
          >
            Trip budget
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Plan private travel expenses. Remaining budget excludes attached
            bookings.
          </p>
        </div>
        {budget ? (
          <span className="text-sm font-semibold text-slate-700">
            {budget.currency}
          </span>
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-800"
        >
          {error}
        </p>
      ) : null}

      {!budget ? (
        <BudgetForm
          amount={amount}
          currency={currency}
          busy={busy}
          readOnly={readOnly}
          onAmount={setAmount}
          onCurrency={setCurrency}
          onSubmit={() => void saveBudget()}
        />
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Summary
              label="Overall budget"
              value={`${budget.amount} ${budget.currency}`}
            />
            <Summary
              label="Planned expenses"
              value={`${budget.plannedTotal} ${budget.currency}`}
            />
            <Summary
              label={
                budget.overBudget
                  ? 'Over budget by'
                  : 'Remaining (excludes bookings)'
              }
              value={`${budget.overBudget ? budget.overBy : budget.remainingAmount} ${budget.currency}`}
              danger={budget.overBudget}
            />
            {categoryRows.slice(0, 2).map((category) => (
              <Summary
                key={category.value}
                label={category.label}
                value={`${category.total} ${budget.currency}`}
              />
            ))}
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {categoryRows.slice(2).map((category) => (
              <Summary
                key={category.value}
                label={category.label}
                value={`${category.total} ${budget.currency}`}
              />
            ))}
          </div>

          <p className="mt-5 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
            {bookingCost?.amount === null
              ? 'Attached booking subtotals are kept separate because currencies are mixed or unknown.'
              : bookingCost?.amount
                ? `Attached booking subtotal: ${bookingCost.amount} ${bookingCost.currency ?? ''} — not included above.`
                : 'No attached booking subtotal is included in this budget.'}
          </p>

          {!readOnly ? (
            <div className="mt-5">
              <BudgetForm
                amount={amount}
                currency={currency}
                busy={busy}
                readOnly={false}
                onAmount={setAmount}
                onCurrency={setCurrency}
                onSubmit={() => void saveBudget()}
                submitLabel="Update overall budget"
              />
              <button
                type="button"
                disabled={busy}
                onClick={() => void removeBudget()}
                className="mt-3 inline-flex items-center gap-2 rounded-md border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 disabled:opacity-60"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Remove budget
              </button>
            </div>
          ) : null}

          {!readOnly ? (
            <div className="mt-6 border-t border-slate-100 pt-5">
              <h3 className="font-semibold text-slate-900">
                {editing ? 'Edit planned expense' : 'Add planned expense'}
              </h3>
              <ExpenseForm
                category={expenseCategory}
                amount={expenseAmount}
                note={expenseNote}
                busy={busy}
                onCategory={setExpenseCategory}
                onAmount={setExpenseAmount}
                onNote={setExpenseNote}
                onSubmit={() => void (editing ? saveExpense() : addExpense())}
                submitLabel={editing ? 'Save expense' : 'Add expense'}
                onCancel={
                  editing
                    ? () => {
                        setEditing(null);
                        setExpenseAmount('');
                        setExpenseNote('');
                      }
                    : undefined
                }
              />
            </div>
          ) : null}

          <ul
            className="mt-6 divide-y divide-slate-100"
            aria-label="Planned expenses"
          >
            {budget.expenses.map((expense) => (
              <li
                key={expense.id}
                className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-medium text-slate-900">
                    {
                      categories.find(
                        (category) => category.value === expense.category,
                      )?.label
                    }
                  </p>
                  <p className="text-sm text-slate-600">
                    {expense.amount} {budget.currency}
                    {expense.note ? ` · ${expense.note}` : ''}
                  </p>
                </div>
                {!readOnly ? (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => beginEdit(expense)}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold text-highland hover:bg-teal-50 disabled:opacity-60"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void removeExpense(expense.id)}
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Remove
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}
      {readOnly ? (
        <p className="mt-5 text-sm text-slate-600">
          Archived trip budgets are retained for reference and cannot be
          changed.
        </p>
      ) : null}
    </section>
  );
}

function Summary({
  label,
  value,
  danger = false,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-md px-3 py-2 ${danger ? 'bg-rose-50 text-rose-900' : 'bg-slate-50 text-slate-800'}`}
    >
      <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
      <p className="mt-1 text-sm font-bold">{value}</p>
    </div>
  );
}

function BudgetForm({
  amount,
  currency,
  busy,
  readOnly,
  onAmount,
  onCurrency,
  onSubmit,
  submitLabel = 'Save budget',
}: {
  amount: string;
  currency: string;
  busy: boolean;
  readOnly: boolean;
  onAmount: (value: string) => void;
  onCurrency: (value: string) => void;
  onSubmit: () => void;
  submitLabel?: string;
}) {
  return (
    <form
      className="mt-5 grid gap-3 sm:grid-cols-[1fr_130px_auto]"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label className="text-sm font-medium text-slate-700">
        Overall budget
        <input
          required
          disabled={busy || readOnly}
          value={amount}
          onChange={(event) => onAmount(event.target.value)}
          inputMode="decimal"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
        />
      </label>
      <label className="text-sm font-medium text-slate-700">
        Currency
        <input
          required
          disabled={busy || readOnly}
          value={currency}
          onChange={(event) => onCurrency(event.target.value.toUpperCase())}
          maxLength={3}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
        />
      </label>
      <button
        type="submit"
        disabled={busy || readOnly}
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-md bg-highland px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
      >
        {busy ? (
          <LoaderCircle className="h-4 w-4 animate-spin" />
        ) : (
          <Plus className="h-4 w-4" />
        )}
        {submitLabel}
      </button>
    </form>
  );
}

function ExpenseForm({
  category,
  amount,
  note,
  busy,
  onCategory,
  onAmount,
  onNote,
  onSubmit,
  submitLabel,
  onCancel,
}: {
  category: TripBudgetCategory;
  amount: string;
  note: string;
  busy: boolean;
  onCategory: (value: TripBudgetCategory) => void;
  onAmount: (value: string) => void;
  onNote: (value: string) => void;
  onSubmit: () => void;
  submitLabel: string;
  onCancel?: () => void;
}) {
  return (
    <form
      className="mt-3 grid gap-3 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      <label className="text-sm font-medium text-slate-700">
        Category
        <select
          value={category}
          disabled={busy}
          onChange={(event) =>
            onCategory(event.target.value as TripBudgetCategory)
          }
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
        >
          {categories.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium text-slate-700">
        Amount
        <input
          required
          value={amount}
          disabled={busy}
          onChange={(event) => onAmount(event.target.value)}
          inputMode="decimal"
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
        />
      </label>
      <label className="text-sm font-medium text-slate-700 sm:col-span-2">
        Note (optional)
        <input
          value={note}
          disabled={busy}
          onChange={(event) => onNote(event.target.value)}
          maxLength={180}
          className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2"
        />
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-highland px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {submitLabel}
        </button>
        {onCancel ? (
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
