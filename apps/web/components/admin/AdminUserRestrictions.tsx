'use client';

import { useLocale, useTranslations } from 'next-intl';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { resolveLocale } from '../../i18n/config';
import { formatLocaleDate } from '../../i18n/format';
import {
  ADMIN_RESTRICTION_CAPABILITIES,
  AdminFetchError,
  AdminUserRestriction,
  AdminUserRestrictionCapability,
  adminFetch,
  localExpiryToIso,
  restrictionActions,
  restrictionState,
} from '../../lib/admin';

const capabilityKeys = {
  BOOKING: 'booking',
  REVIEW: 'review',
  MESSAGING: 'messaging',
  BUSINESS_MANAGEMENT: 'businessManagement',
  PAYMENT_PROOF_SUBMISSION: 'paymentProofSubmission',
} as const;

type DialogAction = {
  kind: 'restrict' | 'lift';
  capability: AdminUserRestrictionCapability;
};

export function AdminUserRestrictions({
  userId,
  name,
  status,
  isAdmin,
}: {
  userId: string;
  name: string;
  status: string;
  isAdmin: boolean;
}) {
  const t = useTranslations('adminUserRestrictions');
  const locale = resolveLocale(useLocale());
  const [rows, setRows] = useState<AdminUserRestriction[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [dialogAction, setDialogAction] = useState<DialogAction | null>(null);
  const [reason, setReason] = useState('');
  const [hasExpiry, setHasExpiry] = useState(false);
  const [localExpiry, setLocalExpiry] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const requestVersion = useRef(0);
  const trigger = useRef<HTMLButtonElement | null>(null);
  const reasonInput = useRef<HTMLTextAreaElement>(null);
  const dialog = useRef<HTMLElement>(null);

  const load = useCallback(async () => {
    const version = ++requestVersion.current;
    try {
      const result = await adminFetch<AdminUserRestriction[]>(
        `/api/admin/users/${userId}/restrictions`,
      );
      if (version === requestVersion.current) {
        setRows(result);
        setLoadError(null);
      }
    } catch (cause) {
      if (version === requestVersion.current) {
        setLoadError(
          cause instanceof AdminFetchError && cause.status === 401
            ? t('authRequired')
            : cause instanceof AdminFetchError && cause.status === 404
              ? t('userNotFound')
              : t('loadError'),
        );
      }
    }
  }, [userId, t]);

  useEffect(() => {
    void load();
    return () => {
      requestVersion.current++;
    };
  }, [load]);

  useEffect(() => {
    if (!dialogAction) return;
    reasonInput.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) {
        event.preventDefault();
        event.stopPropagation();
        setDialogAction(null);
        trigger.current?.focus();
      }
      if (event.key !== 'Tab') return;
      const controls = dialog.current?.querySelectorAll<HTMLElement>(
        'input:not(:disabled), textarea:not(:disabled), button:not(:disabled)',
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
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [dialogAction, saving]);

  function open(action: DialogAction, button: HTMLButtonElement) {
    trigger.current = button;
    setReason('');
    setHasExpiry(false);
    setLocalExpiry('');
    setActionError(null);
    setNotice(null);
    setDialogAction(action);
  }

  function close() {
    setDialogAction(null);
    trigger.current?.focus();
  }

  function actionFailure(cause: unknown): string {
    if (!(cause instanceof AdminFetchError)) return t('actionError');
    if (cause.status === 400) return t('invalidRequest');
    if (cause.status === 401) return t('authRequired');
    if (cause.status === 403) return t('notAllowed');
    if (cause.status === 404) return t('userNotFound');
    if (cause.status === 409) return t('conflict');
    return t('actionError');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dialogAction || saving) return;
    const trimmed = reason.trim();
    if (trimmed.length < 1 || trimmed.length > 1000) {
      setActionError(t('reasonLength'));
      return;
    }
    const expiresAt = hasExpiry ? localExpiryToIso(localExpiry) : null;
    if (dialogAction.kind === 'restrict' && hasExpiry && !expiresAt) {
      setActionError(t('invalidExpiry'));
      return;
    }
    setSaving(true);
    setActionError(null);
    try {
      const path = `/api/admin/users/${userId}/restrictions`;
      await adminFetch(
        dialogAction.kind === 'lift'
          ? `${path}/${dialogAction.capability}/lift`
          : path,
        {
          method: 'POST',
          body: JSON.stringify(
            dialogAction.kind === 'lift'
              ? { reason: trimmed }
              : {
                  capability: dialogAction.capability,
                  reason: trimmed,
                  ...(expiresAt ? { expiresAt } : {}),
                },
          ),
        },
      );
      const succeeded = dialogAction.kind;
      close();
      setNotice(succeeded === 'lift' ? t('liftSuccess') : t('restrictSuccess'));
      await load();
    } catch (cause) {
      setActionError(actionFailure(cause));
      if (cause instanceof AdminFetchError && cause.status === 409) void load();
    } finally {
      setSaving(false);
    }
  }

  const canRestrict = status === 'ACTIVE' && !isAdmin;
  const format = (value: string) =>
    formatLocaleDate(value, locale, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  const selectedLabel = dialogAction
    ? t(capabilityKeys[dialogAction.capability])
    : '';

  return (
    <section
      aria-labelledby="user-restrictions-heading"
      className="rounded-xl border border-slate-200 bg-white p-5"
    >
      <h2
        id="user-restrictions-heading"
        className="text-lg font-bold text-slate-950"
      >
        {t('heading')}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{t('latestStateNote')}</p>
      {notice ? (
        <p
          role="status"
          aria-live="polite"
          className="mt-3 rounded-md bg-emerald-50 p-3 text-sm text-emerald-900"
        >
          {notice}
        </p>
      ) : null}
      {loadError ? (
        <div
          role="alert"
          className="mt-3 rounded-md bg-red-50 p-3 text-sm text-red-800"
        >
          {loadError}{' '}
          <button
            type="button"
            onClick={() => void load()}
            className="font-semibold underline focus:outline-none focus:ring-2 focus:ring-emerald-600"
          >
            {t('retry')}
          </button>
        </div>
      ) : null}
      {!rows && !loadError ? (
        <p aria-live="polite" className="mt-3 text-sm text-slate-600">
          {t('loading')}
        </p>
      ) : null}
      {rows ? (
        <>
          {!canRestrict ? (
            <p className="mt-3 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
              {isAdmin ? t('adminTargetNote') : t('inactiveTargetNote')}
            </p>
          ) : null}
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {ADMIN_RESTRICTION_CAPABILITIES.map((capability) => {
              const row = rows.find((item) => item.capability === capability);
              const state = restrictionState(row);
              const actions = restrictionActions(status, isAdmin, row);
              return (
                <li
                  key={capability}
                  className="min-w-0 rounded-lg border border-slate-200 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="min-w-0 break-words font-semibold text-slate-950">
                      {t(capabilityKeys[capability])}
                    </h3>
                    <span
                      className={`rounded-md px-2 py-1 text-xs font-semibold ${state === 'active' ? 'bg-red-50 text-red-800' : 'bg-slate-100 text-slate-700'}`}
                    >
                      {t(state)}
                    </span>
                  </div>
                  {capability === 'PAYMENT_PROOF_SUBMISSION' ? (
                    <p className="mt-2 break-words text-xs text-amber-900">
                      {t('paymentProofDeferred')}
                    </p>
                  ) : null}
                  {row ? (
                    <dl className="mt-3 space-y-2 text-sm text-slate-700">
                      <div>
                        <dt className="font-semibold">{t('appliedAt')}</dt>
                        <dd>{format(row.restrictedAt)}</dd>
                      </div>
                      <div>
                        <dt className="font-semibold">{t('reason')}</dt>
                        <dd className="break-words [overflow-wrap:anywhere]">
                          {row.reason}
                        </dd>
                      </div>
                      <div>
                        <dt className="font-semibold">{t('expiry')}</dt>
                        <dd>
                          {row.expiresAt
                            ? format(row.expiresAt)
                            : t('noExpiry')}
                        </dd>
                      </div>
                      {row.liftedAt ? (
                        <>
                          <div>
                            <dt className="font-semibold">{t('liftedAt')}</dt>
                            <dd>{format(row.liftedAt)}</dd>
                          </div>
                          {row.liftReason ? (
                            <div>
                              <dt className="font-semibold">
                                {t('liftReason')}
                              </dt>
                              <dd className="break-words [overflow-wrap:anywhere]">
                                {row.liftReason}
                              </dd>
                            </div>
                          ) : null}
                        </>
                      ) : null}
                    </dl>
                  ) : null}
                  {actions.canLift || actions.canRestrict ? (
                    <button
                      type="button"
                      onClick={(event) =>
                        open(
                          {
                            kind: actions.canLift ? 'lift' : 'restrict',
                            capability,
                          },
                          event.currentTarget,
                        )
                      }
                      className={`mt-4 min-h-10 rounded-md px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-offset-2 ${state === 'active' ? 'border border-emerald-700 text-emerald-800 focus:ring-emerald-700' : 'bg-red-700 text-white hover:bg-red-800 focus:ring-red-700'}`}
                    >
                      {actions.canLift ? t('lift') : t('restrict')}
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      ) : null}
      {dialogAction ? (
        <div className="fixed inset-0 z-[1400] grid place-items-center bg-slate-950/55 p-4">
          <section
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="restriction-dialog-heading"
            aria-describedby="restriction-dialog-help"
            className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-2xl sm:p-6"
          >
            <h2
              id="restriction-dialog-heading"
              className="break-words text-lg font-bold text-slate-950"
            >
              {dialogAction.kind === 'lift'
                ? t('liftTitle', { capability: selectedLabel, name })
                : t('restrictTitle', { capability: selectedLabel, name })}
            </h2>
            <p
              id="restriction-dialog-help"
              className="mt-2 text-sm text-slate-600"
            >
              {dialogAction.kind === 'lift' ? t('liftHelp') : t('restrictHelp')}
            </p>
            <form
              noValidate
              onSubmit={(event) => void submit(event)}
              className="mt-5 space-y-4"
            >
              <p className="text-sm font-semibold text-slate-800">
                {t('capability')}: {selectedLabel}
              </p>
              <label className="block text-sm font-semibold text-slate-800">
                {t('reason')}
                <textarea
                  ref={reasonInput}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  required
                  minLength={1}
                  maxLength={1000}
                  rows={4}
                  className="mt-1 block w-full min-w-0 rounded-md border border-slate-300 p-2 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </label>
              <p className="text-xs text-slate-500">
                {t('reasonCount', { count: reason.length })}
              </p>
              {dialogAction.kind === 'restrict' ? (
                <div className="space-y-2">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-800">
                    <input
                      type="checkbox"
                      checked={hasExpiry}
                      onChange={(event) => setHasExpiry(event.target.checked)}
                      className="h-4 w-4 accent-emerald-700 focus:ring-2 focus:ring-emerald-600"
                    />
                    {t('setExpiry')}
                  </label>
                  {hasExpiry ? (
                    <label className="block text-sm font-semibold text-slate-800">
                      {t('expiryLocal')}
                      <input
                        type="datetime-local"
                        value={localExpiry}
                        onChange={(event) => setLocalExpiry(event.target.value)}
                        required
                        className="mt-1 block w-full min-w-0 rounded-md border border-slate-300 p-2 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                      <span className="mt-1 block text-xs font-normal text-slate-600">
                        {t('expiryLocalHelp')}
                      </span>
                    </label>
                  ) : (
                    <p className="text-sm text-slate-600">{t('noExpiry')}</p>
                  )}
                </div>
              ) : null}
              {actionError ? (
                <p
                  role="alert"
                  className="rounded-md bg-red-50 p-3 text-sm text-red-800"
                >
                  {actionError}
                </p>
              ) : null}
              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  disabled={saving}
                  onClick={close}
                  className="min-h-10 rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="min-h-10 rounded-md bg-emerald-700 px-3 py-2 font-semibold text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-700 disabled:opacity-60"
                >
                  {saving
                    ? t('saving')
                    : dialogAction.kind === 'lift'
                      ? t('confirmLift')
                      : t('confirmRestrict')}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </section>
  );
}
