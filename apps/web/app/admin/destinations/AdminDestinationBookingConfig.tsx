'use client';

import {
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  AdminDestinationBookingConfig as Config,
  AdminDestinationBookingConfigUpdateInput,
  AdminDestinationPaymentAccount as Account,
  AdminDestinationPaymentAccountCreateInput,
  AdminDestinationPaymentAccountUpdateInput,
  AdminDestinationPaymentProvider as Provider,
  AdminFetchError,
  AdminPage,
  adminFetch,
} from '../../../lib/admin';

const amountPattern = /^(?:0|[1-9]\d{0,9})\.\d{2}$/;
const identifierPattern = /^[+A-Za-z0-9][A-Za-z0-9 +-]{3,62}[A-Za-z0-9]$/;

type AccountForm = {
  provider: Provider;
  accountHolderName: string;
  accountIdentifier: string;
  instructions: string;
  displayOrder: string;
};

type FeedbackKey =
  | 'loadError'
  | 'savedRefreshError'
  | 'saveError'
  | 'sessionError'
  | 'forbiddenError'
  | 'notFoundError'
  | 'conflictError'
  | 'validationError'
  | 'invalidPrice'
  | 'textTooLong'
  | 'invalidAccount'
  | 'configSaved'
  | 'accountSaved'
  | 'accountCreated'
  | 'accountDeactivated'
  | 'accountReactivated'
  | 'bookingDisabled';

const emptyAccount: AccountForm = {
  provider: 'TELEBIRR',
  accountHolderName: '',
  accountIdentifier: '',
  instructions: '',
  displayOrder: '0',
};

export function maskAccountIdentifier(value: string) {
  const suffix = value.replace(/\s/g, '').slice(-4);
  return `•••• ${suffix}`;
}

export function AdminDestinationBookingConfig({
  destinationId,
  destinationName,
  publicationStatus,
}: {
  destinationId: string;
  destinationName: string;
  publicationStatus: string;
}) {
  const t = useTranslations('adminPortal.destinationBookingConfig');
  const locale = useLocale();
  const [config, setConfig] = useState<Config | null>(null);
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountTotal, setAccountTotal] = useState(0);
  const [accountPage, setAccountPage] = useState(1);
  const [accountPages, setAccountPages] = useState(1);
  const [accountForm, setAccountForm] = useState<AccountForm>(emptyAccount);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAccountForm, setShowAccountForm] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    id: string;
    kind: 'deactivate' | 'reactivate';
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [error, setError] = useState<FeedbackKey | null>(null);
  const [notice, setNotice] = useState<FeedbackKey | null>(null);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const confirmButton = useRef<HTMLButtonElement>(null);
  const cancelConfirmButton = useRef<HTMLButtonElement>(null);
  const disableTrigger = useRef<HTMLButtonElement>(null);
  const disableConfirmButton = useRef<HTMLButtonElement>(null);
  const cancelDisableButton = useRef<HTMLButtonElement>(null);
  const bookingHeading = useRef<HTMLHeadingElement>(null);
  const createTrigger = useRef<HTMLButtonElement>(null);
  const accountTriggers = useRef(new Map<string, HTMLButtonElement>());
  const statusTriggers = useRef(new Map<string, HTMLButtonElement>());
  const path = `/api/admin/destinations/${destinationId}`;
  const archived = publicationStatus === 'ARCHIVED';

  const load = useCallback(
    async (page = 1, resetForm = false) => {
      const [current, result] = await Promise.all([
        adminFetch<Config>(`${path}/booking-config`),
        adminFetch<AdminPage<Account>>(
          `${path}/payment-accounts?page=${page}&limit=100`,
        ),
      ]);
      setConfig(current);
      if (resetForm) {
        setPrice(current.priceAmount ?? '');
        setDescription(current.requestDescription ?? '');
        setInstructions(current.bookingInstructions ?? '');
      }
      setAccounts(result.data);
      setAccountTotal(result.meta.total);
      setAccountPage(result.meta.page);
      setAccountPages(result.meta.totalPages);
    },
    [path],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    void load(1, true)
      .catch(() => active && setError('loadError'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [load, t]);

  useEffect(() => {
    if (confirmAction) confirmButton.current?.focus();
  }, [confirmAction]);

  useEffect(() => {
    if (confirmDisable) disableConfirmButton.current?.focus();
  }, [confirmDisable]);

  function errorText(cause: unknown, fallback: FeedbackKey): FeedbackKey {
    if (cause instanceof AdminFetchError) {
      if (cause.status === 401) return 'sessionError';
      if (cause.status === 403) return 'forbiddenError';
      if (cause.status === 404) return 'notFoundError';
      if (cause.status === 409) return 'conflictError';
      if (cause.status === 400) return 'validationError';
    }
    return fallback;
  }

  async function mutate(
    operation: () => Promise<unknown>,
    success: FeedbackKey,
    page = accountPage,
  ) {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await operation();
      try {
        await load(page, true);
      } catch {
        setError('savedRefreshError');
        return false;
      }
      setNotice(success);
      return true;
    } catch (cause) {
      setError(errorText(cause, 'saveError'));
      if (cause instanceof AdminFetchError && cause.status === 409) {
        try {
          await load(page, true);
        } catch {
          /* Keep the conflict visible. */
        }
      }
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function saveConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!config || config.bookingEnabled || archived || busyRef.current) return;
    const priceAmount = price.trim() || null;
    if (
      priceAmount &&
      (!amountPattern.test(priceAmount) || priceAmount === '0.00')
    ) {
      setError('invalidPrice');
      return;
    }
    if (description.length > 1000 || instructions.length > 1000) {
      setError('textTooLong');
      return;
    }
    const update: AdminDestinationBookingConfigUpdateInput = {
      bookingEnabled: false,
      priceAmount,
      requestDescription: description.trim() || null,
      bookingInstructions: instructions.trim() || null,
      currency: 'ETB',
      priceUnit: 'PER_BOOKING',
    };
    await mutate(
      () =>
        adminFetch(`${path}/booking-config`, {
          method: 'PUT',
          body: JSON.stringify(update),
        }),
      'configSaved',
    );
  }

  function openCreate() {
    setEditingId(null);
    setAccountForm(emptyAccount);
    setShowAccountForm(true);
    setError(null);
  }

  function openEdit(account: Account) {
    setEditingId(account.id);
    setAccountForm({
      provider: account.provider,
      accountHolderName: account.accountHolderName,
      accountIdentifier: account.accountIdentifier,
      instructions: account.instructions ?? '',
      displayOrder: String(account.displayOrder),
    });
    setShowAccountForm(true);
    setError(null);
  }

  function closeAccountForm() {
    const previousId = editingId;
    setShowAccountForm(false);
    setEditingId(null);
    if (previousId) accountTriggers.current.get(previousId)?.focus();
    else createTrigger.current?.focus();
  }

  function updateAccountField<Key extends keyof AccountForm>(
    key: Key,
    value: AccountForm[Key],
  ) {
    setAccountForm((current) => ({ ...current, [key]: value }));
  }

  async function saveAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busyRef.current || archived) return;
    const holder = accountForm.accountHolderName.trim();
    const identifier = accountForm.accountIdentifier.trim();
    const order = Number(accountForm.displayOrder);
    if (
      !holder ||
      holder.length > 160 ||
      !identifierPattern.test(identifier) ||
      identifier.length > 64 ||
      accountForm.instructions.length > 1000 ||
      !Number.isInteger(order) ||
      order < 0 ||
      order > 9999
    ) {
      setError('invalidAccount');
      return;
    }
    const body: AdminDestinationPaymentAccountCreateInput = {
      provider: accountForm.provider,
      accountHolderName: holder,
      accountIdentifier: identifier,
      instructions: accountForm.instructions.trim() || null,
      displayOrder: order,
    };
    const success = await mutate(
      () =>
        adminFetch(
          editingId
            ? `${path}/payment-accounts/${editingId}`
            : `${path}/payment-accounts`,
          { method: editingId ? 'PATCH' : 'POST', body: JSON.stringify(body) },
        ),
      editingId ? 'accountSaved' : 'accountCreated',
      editingId ? accountPage : 1,
    );
    if (success) closeAccountForm();
  }

  function closeConfirm() {
    const id = confirmAction?.id;
    setConfirmAction(null);
    if (id) statusTriggers.current.get(id)?.focus();
  }

  async function changeAccountStatus() {
    if (!confirmAction || busyRef.current) return;
    const { id, kind } = confirmAction;
    const success = await mutate(
      () =>
        kind === 'deactivate'
          ? adminFetch(`${path}/payment-accounts/${id}/deactivate`, {
              method: 'POST',
            })
          : adminFetch(`${path}/payment-accounts/${id}`, {
              method: 'PATCH',
              body: JSON.stringify({
                isActive: true,
              } satisfies AdminDestinationPaymentAccountUpdateInput),
            }),
      kind === 'deactivate' ? 'accountDeactivated' : 'accountReactivated',
    );
    if (success) closeConfirm();
  }

  function closeDisable() {
    setConfirmDisable(false);
    disableTrigger.current?.focus();
  }

  async function disableBooking() {
    if (!config?.bookingEnabled || archived || busyRef.current) return;
    const update: AdminDestinationBookingConfigUpdateInput = {
      bookingEnabled: false,
      priceAmount: config.priceAmount,
      requestDescription: config.requestDescription,
      bookingInstructions: config.bookingInstructions,
      currency: 'ETB',
      priceUnit: 'PER_BOOKING',
    };
    await mutate(
      () =>
        adminFetch(`${path}/booking-config`, {
          method: 'PUT',
          body: JSON.stringify(update),
        }),
      'bookingDisabled',
    );
    setConfirmDisable(false);
    bookingHeading.current?.focus();
  }

  function disableKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && !busy) {
      event.preventDefault();
      closeDisable();
    }
    if (event.key === 'Tab' && !busy) {
      if (event.shiftKey && event.target === disableConfirmButton.current) {
        event.preventDefault();
        cancelDisableButton.current?.focus();
      } else if (
        !event.shiftKey &&
        event.target === cancelDisableButton.current
      ) {
        event.preventDefault();
        disableConfirmButton.current?.focus();
      }
    }
  }

  function confirmKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && !busy) {
      event.preventDefault();
      closeConfirm();
    }
    if (event.key === 'Tab' && !busy) {
      if (event.shiftKey && event.target === confirmButton.current) {
        event.preventDefault();
        cancelConfirmButton.current?.focus();
      } else if (
        !event.shiftKey &&
        event.target === cancelConfirmButton.current
      ) {
        event.preventDefault();
        confirmButton.current?.focus();
      }
    }
  }

  const activeOnPage = accounts.filter((account) => account.isActive).length;
  const priceReady = Boolean(
    config?.priceAmount && config.priceAmount !== '0.00',
  );
  const descriptionReady = Boolean(
    config?.requestDescription && config.requestDescription.trim().length >= 10,
  );
  const accountReadiness = accountTotal <= 100 ? activeOnPage > 0 : null;
  const confirmAccount = accounts.find(
    (account) => account.id === confirmAction?.id,
  );
  const date = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat(locale === 'am' ? 'am-ET' : 'en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }).format(new Date(value))
      : t('notSaved');

  return (
    <section
      className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      aria-labelledby="destination-booking-config-heading"
    >
      <h2
        ref={bookingHeading}
        id="destination-booking-config-heading"
        className="text-lg font-bold text-slate-950"
        tabIndex={-1}
      >
        {t('title')}
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        {t('description', { name: destinationName })}
      </p>
      <p className="mt-2 text-sm text-slate-700">
        {t('publicationStatus')}:{' '}
        {publicationStatus === 'PUBLISHED'
          ? t('statusPublished')
          : publicationStatus === 'DRAFT'
            ? t('statusDraft')
            : publicationStatus === 'INACTIVE'
              ? t('statusInactive')
              : t('statusArchived')}
      </p>
      <p className="mt-2 rounded-md bg-amber-50 p-3 text-sm text-amber-950">
        {t('activationPolicy')}
      </p>
      {config?.bookingEnabled ? (
        <div className="mt-2 rounded-md bg-red-50 p-3 text-sm text-red-900">
          <p role="alert">{t('alreadyEnabledWarning')}</p>
          {!archived ? (
            <button
              ref={disableTrigger}
              type="button"
              disabled={busy}
              onClick={() => setConfirmDisable(true)}
              className="mt-3 min-h-11 rounded border border-red-700 px-3 py-2 font-semibold disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
            >
              {t('disableBooking')}
            </button>
          ) : null}
        </div>
      ) : null}
      {archived ? (
        <p className="mt-2 text-sm text-slate-600">{t('archivedReadOnly')}</p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="mt-3 break-words rounded-md bg-red-50 p-3 text-sm text-red-900"
        >
          {t(error)}
        </p>
      ) : null}
      {notice ? (
        <p
          aria-live="polite"
          className="mt-3 rounded-md bg-emerald-50 p-3 text-sm text-emerald-900"
        >
          {t(notice)}
        </p>
      ) : null}
      {loading ? (
        <p role="status" className="mt-4 text-sm">
          {t('loading')}
        </p>
      ) : null}
      {!loading && !config ? (
        <button
          type="button"
          onClick={() => void load(1, true).catch(() => setError('loadError'))}
          className="mt-3 rounded border px-3 py-2 focus-visible:outline focus-visible:outline-2"
        >
          {t('retry')}
        </button>
      ) : null}
      {config ? (
        <>
          <form
            onSubmit={(event) => void saveConfig(event)}
            className="mt-5 space-y-4"
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="destination-booking-enabled"
                  className="block text-sm font-semibold"
                >
                  {t('bookingActivation')}
                </label>
                <input
                  id="destination-booking-enabled"
                  type="checkbox"
                  checked={config.bookingEnabled}
                  disabled
                  aria-describedby="destination-booking-policy"
                  className="mt-2 h-5 w-5"
                  readOnly
                />
                <span className="ml-2 text-sm">
                  {config.bookingEnabled ? t('enabled') : t('disabled')}
                </span>
                <p
                  id="destination-booking-policy"
                  className="mt-1 text-xs text-slate-600"
                >
                  {t('activationPolicy')}
                </p>
              </div>
              <p className="text-sm text-slate-700">
                {t('priceUnit')}: {t('perBooking')}
                <br />
                {t('quantity')}: 1<br />
                {t('updated')}: {date(config.updatedAt)}
              </p>
            </div>
            <label
              className="block text-sm font-semibold"
              htmlFor="destination-request-price"
            >
              {t('requestPrice')} ({t('etb')})
            </label>
            <input
              id="destination-request-price"
              inputMode="decimal"
              type="text"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
              placeholder="1500.00"
              maxLength={13}
              disabled={busy || archived || config.bookingEnabled}
              className="block min-h-11 w-full rounded-md border border-slate-300 px-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"
            />
            <label
              className="block text-sm font-semibold"
              htmlFor="destination-request-description"
            >
              {t('requestDescription')}
            </label>
            <textarea
              id="destination-request-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={1000}
              rows={3}
              disabled={busy || archived || config.bookingEnabled}
              className="block w-full rounded-md border border-slate-300 p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"
            />
            <label
              className="block text-sm font-semibold"
              htmlFor="destination-booking-instructions"
            >
              {t('bookingInstructions')}
            </label>
            <textarea
              id="destination-booking-instructions"
              value={instructions}
              onChange={(event) => setInstructions(event.target.value)}
              maxLength={1000}
              rows={3}
              disabled={busy || archived || config.bookingEnabled}
              className="block w-full rounded-md border border-slate-300 p-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"
            />
            <div className="rounded-md border border-slate-200 p-3 text-sm text-slate-700">
              <p className="font-semibold">{t('readiness')}</p>
              <p>
                {t('priceReady')}: {priceReady ? t('yes') : t('no')}
              </p>
              <p>
                {t('descriptionReady')}: {descriptionReady ? t('yes') : t('no')}
              </p>
              <p>
                {t('accountReady')}:{' '}
                {accountReadiness === null
                  ? t('checkAllAccounts')
                  : accountReadiness
                    ? t('yes')
                    : t('no')}
              </p>
              <p className="mt-1 text-xs">{t('readinessNotApproval')}</p>
            </div>
            <button
              type="submit"
              disabled={busy || archived || config.bookingEnabled}
              className="min-h-11 rounded-md bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
            >
              {busy ? t('saving') : t('saveConfig')}
            </button>
          </form>
          <div className="mt-7 border-t border-slate-200 pt-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-950">
                  {t('accounts')}
                </h3>
                <p className="text-sm text-slate-600">{t('accountsHelp')}</p>
              </div>
              <button
                ref={createTrigger}
                type="button"
                disabled={busy || archived}
                onClick={openCreate}
                className="min-h-11 rounded-md border border-emerald-700 px-3 py-2 font-semibold text-emerald-800 disabled:opacity-50 focus-visible:outline focus-visible:outline-2"
              >
                {t('addAccount')}
              </button>
            </div>
            {accounts.length === 0 ? (
              <p className="mt-3 text-sm text-slate-600">{t('noAccounts')}</p>
            ) : null}
            <ul className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
              {accounts.map((account) => (
                <li
                  key={account.id}
                  className="min-w-0 rounded-md border border-slate-200 p-3 text-sm"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong>
                      {t(
                        account.provider === 'CBE'
                          ? 'providerCbe'
                          : 'providerTelebirr',
                      )}
                    </strong>
                    <span>
                      {account.isActive ? t('active') : t('inactive')}
                    </span>
                  </div>
                  <p className="mt-1 break-words">
                    {account.accountHolderName}
                  </p>
                  <p>{maskAccountIdentifier(account.accountIdentifier)}</p>
                  <p>
                    {t('displayOrder')}: {account.displayOrder}
                  </p>
                  {account.instructions ? (
                    <p className="mt-1 break-words whitespace-pre-wrap">
                      {account.instructions}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      ref={(element) => {
                        if (element)
                          accountTriggers.current.set(account.id, element);
                        else accountTriggers.current.delete(account.id);
                      }}
                      disabled={busy || archived}
                      onClick={() => openEdit(account)}
                      className="min-h-11 rounded border px-3 py-2 focus-visible:outline focus-visible:outline-2"
                    >
                      {t('editAccount')}
                    </button>
                    <button
                      type="button"
                      ref={(element) => {
                        if (element)
                          statusTriggers.current.set(account.id, element);
                        else statusTriggers.current.delete(account.id);
                      }}
                      disabled={busy || archived}
                      onClick={() =>
                        setConfirmAction({
                          id: account.id,
                          kind: account.isActive ? 'deactivate' : 'reactivate',
                        })
                      }
                      className={`min-h-11 rounded border px-3 py-2 focus-visible:outline focus-visible:outline-2 ${account.isActive ? 'border-red-300 text-red-800' : 'border-emerald-700 text-emerald-800'}`}
                    >
                      {t(account.isActive ? 'deactivate' : 'reactivate')}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            {accountPages > 1 ? (
              <div className="mt-3 flex items-center gap-3 text-sm">
                <button
                  type="button"
                  disabled={busy || accountPage <= 1}
                  onClick={() =>
                    void load(accountPage - 1).catch(() =>
                      setError('loadError'),
                    )
                  }
                  className="min-h-11 rounded border px-3 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                >
                  {t('previous')}
                </button>
                <span>
                  {t('pageOf', { page: accountPage, total: accountPages })}
                </span>
                <button
                  type="button"
                  disabled={busy || accountPage >= accountPages}
                  onClick={() =>
                    void load(accountPage + 1).catch(() =>
                      setError('loadError'),
                    )
                  }
                  className="min-h-11 rounded border px-3 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                >
                  {t('next')}
                </button>
              </div>
            ) : null}
            {showAccountForm ? (
              <form
                onSubmit={(event) => void saveAccount(event)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape' && !busy) {
                    event.preventDefault();
                    closeAccountForm();
                  }
                }}
                className="mt-4 min-w-0 space-y-3 rounded-lg border border-emerald-200 p-3 sm:p-4"
                aria-label={editingId ? t('editAccount') : t('addAccount')}
              >
                <h4 className="font-semibold">
                  {editingId ? t('editAccount') : t('addAccount')}
                </h4>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-sm font-semibold">
                    {t('provider')}
                    <select
                      value={accountForm.provider}
                      disabled={busy}
                      onChange={(event) =>
                        updateAccountField(
                          'provider',
                          event.target.value as Provider,
                        )
                      }
                      className="mt-1 block min-h-11 w-full rounded border p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"
                    >
                      <option value="TELEBIRR">{t('providerTelebirr')}</option>
                      <option value="CBE">{t('providerCbe')}</option>
                    </select>
                  </label>
                  <label className="text-sm font-semibold">
                    {t('displayOrder')}
                    <input
                      type="number"
                      min="0"
                      max="9999"
                      step="1"
                      value={accountForm.displayOrder}
                      disabled={busy}
                      onChange={(event) =>
                        updateAccountField('displayOrder', event.target.value)
                      }
                      className="mt-1 block min-h-11 w-full rounded border p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"
                    />
                  </label>
                </div>
                <label className="block text-sm font-semibold">
                  {t('holder')}
                  <input
                    required
                    maxLength={160}
                    autoComplete="off"
                    value={accountForm.accountHolderName}
                    disabled={busy}
                    onChange={(event) =>
                      updateAccountField(
                        'accountHolderName',
                        event.target.value,
                      )
                    }
                    className="mt-1 block min-h-11 w-full rounded border p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"
                  />
                </label>
                <label className="block text-sm font-semibold">
                  {t('identifier')}
                  <input
                    required
                    maxLength={64}
                    autoComplete="off"
                    value={accountForm.accountIdentifier}
                    disabled={busy}
                    onChange={(event) =>
                      updateAccountField(
                        'accountIdentifier',
                        event.target.value,
                      )
                    }
                    className="mt-1 block min-h-11 w-full rounded border p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"
                  />
                </label>
                <p className="text-xs text-slate-600">{t('identifierHelp')}</p>
                <label className="block text-sm font-semibold">
                  {t('accountInstructions')}
                  <textarea
                    maxLength={1000}
                    rows={2}
                    value={accountForm.instructions}
                    disabled={busy}
                    onChange={(event) =>
                      updateAccountField('instructions', event.target.value)
                    }
                    className="mt-1 block w-full rounded border p-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-emerald-700"
                  />
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={busy}
                    className="min-h-11 rounded bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                  >
                    {busy ? t('saving') : t('saveAccount')}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={closeAccountForm}
                    className="min-h-11 rounded border px-4 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
                  >
                    {t('cancel')}
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        </>
      ) : null}
      {confirmAccount ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t(
            confirmAction?.kind === 'deactivate'
              ? 'confirmDeactivation'
              : 'confirmReactivation',
          )}
          onKeyDown={confirmKeyDown}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3"
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
            <h3 className="font-bold">
              {t(
                confirmAction?.kind === 'deactivate'
                  ? 'confirmDeactivation'
                  : 'confirmReactivation',
              )}
            </h3>
            <p className="mt-2 break-words text-sm">
              {t(
                confirmAction?.kind === 'deactivate'
                  ? 'deactivationPrompt'
                  : 'reactivationPrompt',
                {
                  provider: t(
                    confirmAccount.provider === 'CBE'
                      ? 'providerCbe'
                      : 'providerTelebirr',
                  ),
                  identifier: maskAccountIdentifier(
                    confirmAccount.accountIdentifier,
                  ),
                },
              )}
            </p>
            {confirmAction?.kind === 'deactivate' ? (
              <p className="mt-2 text-sm text-amber-900">
                {t('lastAccountWarning')}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                ref={confirmButton}
                type="button"
                disabled={busy}
                onClick={() => void changeAccountStatus()}
                className={`min-h-11 rounded px-4 py-2 font-semibold text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${confirmAction?.kind === 'deactivate' ? 'bg-red-700 focus-visible:outline-red-700' : 'bg-emerald-700 focus-visible:outline-emerald-700'}`}
              >
                {t(
                  confirmAction?.kind === 'deactivate'
                    ? 'deactivate'
                    : 'reactivate',
                )}
              </button>
              <button
                ref={cancelConfirmButton}
                type="button"
                disabled={busy}
                onClick={closeConfirm}
                className="min-h-11 rounded border px-4 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
      {confirmDisable ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('confirmDisable')}
          onKeyDown={disableKeyDown}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3"
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white p-5 shadow-xl">
            <h3 className="font-bold">{t('confirmDisable')}</h3>
            <p className="mt-2 break-words text-sm">
              {t('disablePrompt', { name: destinationName })}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                ref={disableConfirmButton}
                type="button"
                disabled={busy}
                onClick={() => void disableBooking()}
                className="min-h-11 rounded bg-red-700 px-4 py-2 font-semibold text-white disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"
              >
                {t('disableBooking')}
              </button>
              <button
                ref={cancelDisableButton}
                type="button"
                disabled={busy}
                onClick={closeDisable}
                className="min-h-11 rounded border px-4 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
