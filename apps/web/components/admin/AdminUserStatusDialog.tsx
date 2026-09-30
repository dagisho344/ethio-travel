'use client';

import { useTranslations } from 'next-intl';
import { FormEvent, useEffect, useRef, useState } from 'react';
import { adminFetch } from '../../lib/admin';

type UserAction = 'suspend' | 'restore' | 'deactivate' | 'reactivate';
const actionKeys = {
  suspend: 'blockUser',
  restore: 'unblockUser',
  deactivate: 'deactivateUser',
  reactivate: 'reactivateUser',
} as const;

export function AdminUserStatusDialog({
  action,
  name,
  onComplete,
  userId,
}: {
  action: UserAction;
  name: string;
  onComplete: () => void;
  userId: string;
}) {
  const t = useTranslations('adminUsers');
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const destructive = action === 'suspend' || action === 'deactivate';

  useEffect(() => {
    if (!open) return;
    input.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) {
        setOpen(false);
        trigger.current?.focus();
      }
      if (event.key === 'Tab') {
        const controls = dialog.current?.querySelectorAll<HTMLElement>(
          'textarea:not(:disabled), button:not(:disabled)',
        );
        if (!controls?.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (!first || !last) return;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, saving]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    const text = reason.trim();
    if (text.length < 3 || text.length > 1000) {
      setError(t('reasonLength'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await adminFetch(`/api/admin/users/${userId}/${action}`, {
        method: 'POST',
        body: JSON.stringify({ reason: text }),
      });
      setOpen(false);
      setReason('');
      trigger.current?.focus();
      onComplete();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t('actionError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <button
        ref={trigger}
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
        className={`min-h-10 rounded-md px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 ${destructive ? 'bg-red-700 hover:bg-red-800 focus:ring-red-700' : 'bg-emerald-700 hover:bg-emerald-800 focus:ring-emerald-700'}`}
      >
        {t(actionKeys[action])}
      </button>
      {open ? (
        <div className="fixed inset-0 z-[1400] grid place-items-center bg-slate-950/55 p-4">
          <section
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`user-action-${action}`}
            aria-describedby={`user-action-note-${action}`}
            className="w-full max-w-md rounded-xl bg-white p-5 shadow-2xl sm:p-6"
          >
            <h2
              id={`user-action-${action}`}
              className="break-words text-lg font-bold text-slate-950"
            >
              {t('confirmAction', { action: t(actionKeys[action]), name })}
            </h2>
            <p
              id={`user-action-note-${action}`}
              className="mt-2 text-sm text-slate-600"
            >
              {destructive ? t('confirmWarning') : t('confirmRestore')}
            </p>
            <form
              onSubmit={(event) => {
                void submit(event);
              }}
              className="mt-5 space-y-4"
            >
              <label className="block text-sm font-semibold text-slate-800">
                {t('reason')}
                <textarea
                  ref={input}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  required
                  minLength={3}
                  maxLength={1000}
                  rows={4}
                  className="mt-1 block w-full rounded-md border border-slate-300 p-2 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </label>
              {error ? (
                <p role="alert" className="text-sm text-red-700">
                  {error}
                </p>
              ) : null}
              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setOpen(false);
                    trigger.current?.focus();
                  }}
                  className="rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className={`rounded-md px-3 py-2 font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-60 ${destructive ? 'bg-red-700 focus:ring-red-700' : 'bg-emerald-700 focus:ring-emerald-700'}`}
                >
                  {saving ? t('saving') : t(actionKeys[action])}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
