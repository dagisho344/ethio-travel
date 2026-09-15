'use client';

import { FormEvent, useEffect, useState } from 'react';
import { adminFetch } from '../../lib/admin';

export function AdminNoteActionDialog({
  action,
  endpoint,
  field,
  onComplete,
  target,
}: {
  action: string;
  endpoint: string;
  field: 'moderationNote' | 'resolution';
  onComplete: () => void;
  target: string;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) setOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [open, saving]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (note.trim().length < 3) {
      setError('Enter at least 3 characters.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await adminFetch(endpoint, {
        body: JSON.stringify({ [field]: note }),
        method: 'POST',
      });
      setOpen(false);
      setNote('');
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
        className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
      >
        {action}
      </button>
      {open ? (
        <div className="fixed inset-0 z-[1400] grid place-items-center bg-slate-950/45 p-4">
          <section
            role="dialog"
            aria-modal="true"
            aria-label={`${action} confirmation`}
            className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl"
          >
            <h2 className="text-lg font-bold text-slate-950">
              {action} {target}?
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              This action preserves historical content and creates an audit
              record.
            </p>
            <form
              onSubmit={(event) => {
                void submit(event);
              }}
              className="mt-5 space-y-4"
            >
              <label className="block text-sm font-semibold text-slate-800">
                {field === 'resolution'
                  ? 'Resolution note'
                  : 'Moderation reason'}
                <textarea
                  required
                  minLength={3}
                  maxLength={1000}
                  rows={4}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
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
                  className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
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
