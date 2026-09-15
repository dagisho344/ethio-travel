'use client';

import { useState } from 'react';
import { adminFetch } from '../../lib/admin';

export function AdminActionDialog({
  action,
  endpoint,
  onComplete,
  target,
}: {
  action: 'Restore' | 'Suspend';
  endpoint: string;
  onComplete: () => void;
  target: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const destructive = action === 'Suspend';

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (reason.trim().length < 3) {
      setError('Enter a reason of at least 3 characters.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await adminFetch(endpoint, {
        body: JSON.stringify({ reason }),
        method: 'POST',
      });
      setOpen(false);
      setReason('');
      onComplete();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Action failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`rounded-md px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 ${
          destructive
            ? 'bg-red-700 text-white hover:bg-red-800 focus:ring-red-700'
            : 'bg-emerald-700 text-white hover:bg-emerald-800 focus:ring-emerald-700'
        }`}
      >
        {action}
      </button>
      {open ? (
        <div className="fixed inset-0 z-[1400] grid place-items-center bg-slate-950/45 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-action-title"
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
          >
            <h2
              id="admin-action-title"
              className="text-lg font-bold text-slate-950"
            >
              {action} {target}?
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              {destructive
                ? 'This preserves historical records but immediately changes access or public eligibility where applicable.'
                : 'This restores the target only when its current lifecycle allows it.'}
            </p>
            <form
              className="mt-5 space-y-4"
              onSubmit={(event) => {
                void submit(event);
              }}
            >
              <label className="block text-sm font-semibold text-slate-800">
                Reason
                <textarea
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  minLength={3}
                  maxLength={1000}
                  required
                  rows={4}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </label>
              {error ? (
                <p role="alert" className="text-sm text-red-700">
                  {error}
                </p>
              ) : null}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setOpen(false)}
                  className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={`rounded-md px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                    destructive
                      ? 'bg-red-700 hover:bg-red-800 focus:ring-red-700'
                      : 'bg-emerald-700 hover:bg-emerald-800 focus:ring-emerald-700'
                  }`}
                >
                  {saving ? 'Saving…' : action}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
