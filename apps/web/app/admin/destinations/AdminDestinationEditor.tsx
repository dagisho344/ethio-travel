'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, KeyboardEvent, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  AdminCity,
  AdminDestination,
  AdminDestinationTranslation,
  AdminFetchError,
  AdminPage,
  adminFetch,
  statusClass,
} from '../../../lib/admin';

type Form = {
  cityId: string;
  fullDescription: string;
  latitude: string;
  longitude: string;
  name: string;
  shortDescription: string;
  slug: string;
};

type TranslationForm = {
  bestTimeToVisit: string;
  displayName: string;
  fullDescription: string;
  gettingThere: string;
  localTips: string;
  safetyNotes: string;
  shortDescription: string;
};

type EditorTab = 'english' | 'amharic';
type TranslationAction = 'publish' | 'unpublish';

const empty: Form = {
  cityId: '',
  fullDescription: '',
  latitude: '',
  longitude: '',
  name: '',
  shortDescription: '',
  slug: '',
};

const emptyTranslation: TranslationForm = {
  bestTimeToVisit: '',
  displayName: '',
  fullDescription: '',
  gettingThere: '',
  localTips: '',
  safetyNotes: '',
  shortDescription: '',
};

const toForm = (item: AdminDestination): Form => ({
  cityId: item.cityId,
  fullDescription: item.fullDescription,
  latitude: String(item.latitude),
  longitude: String(item.longitude),
  name: item.name,
  shortDescription: item.shortDescription,
  slug: item.slug,
});

const toTranslationForm = (
  translation: AdminDestinationTranslation | null,
): TranslationForm => ({
  bestTimeToVisit: translation?.bestTimeToVisit ?? '',
  displayName: translation?.displayName ?? '',
  fullDescription: translation?.fullDescription ?? '',
  gettingThere: translation?.gettingThere ?? '',
  localTips: translation?.localTips ?? '',
  safetyNotes: translation?.safetyNotes ?? '',
  shortDescription: translation?.shortDescription ?? '',
});

function optionalText(value: string): string | null {
  const trimmed = value.trim();
  return trimmed || null;
}

function translationIsComplete(value: TranslationForm): boolean {
  return Boolean(
    optionalText(value.shortDescription) && optionalText(value.fullDescription),
  );
}

function canonicalTravelText(
  destination: AdminDestination,
  field: keyof Pick<
    TranslationForm,
    'bestTimeToVisit' | 'gettingThere' | 'localTips' | 'safetyNotes'
  >,
): string | null {
  const value = destination.travelInfo?.[field];
  return typeof value === 'string' ? optionalText(value) : null;
}

export function AdminDestinationEditor({
  destinationId,
  editable,
}: {
  destinationId?: string;
  editable: boolean;
}) {
  const t = useTranslations('adminPortal');
  const router = useRouter();
  const [item, setItem] = useState<AdminDestination | null>(null);
  const [cities, setCities] = useState<AdminCity[]>([]);
  const [form, setForm] = useState<Form>(empty);
  const [translation, setTranslation] =
    useState<AdminDestinationTranslation | null>(null);
  const [translationForm, setTranslationForm] =
    useState<TranslationForm>(emptyTranslation);
  const [activeTab, setActiveTab] = useState<EditorTab>('english');
  const [error, setError] = useState<string | null>(null);
  const [translationError, setTranslationError] = useState<string | null>(null);
  const [translationNotice, setTranslationNotice] = useState<string | null>(
    null,
  );
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [translationLoading, setTranslationLoading] = useState(
    Boolean(destinationId),
  );
  const [confirm, setConfirm] = useState<'publish' | 'unpublish' | null>(null);
  const [translationConfirm, setTranslationConfirm] =
    useState<TranslationAction | null>(null);

  useEffect(() => {
    let active = true;
    const citiesRequest = adminFetch<AdminPage<AdminCity>>(
      '/api/admin/locations/cities?limit=100',
    ).then((result) => active && setCities(result.data));
    const itemRequest = destinationId
      ? adminFetch<AdminDestination>(
          `/api/admin/destinations/${destinationId}`,
        ).then((result) => {
          if (active) {
            setItem(result);
            setForm(toForm(result));
          }
        })
      : Promise.resolve();
    void Promise.all([citiesRequest, itemRequest])
      .catch(
        (cause: unknown) =>
          active &&
          setError(
            cause instanceof Error
              ? cause.message
              : t('destinationUnavailable'),
          ),
      )
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [destinationId, t]);

  useEffect(() => {
    if (!destinationId) {
      setTranslationLoading(false);
      return;
    }
    let active = true;
    setTranslationLoading(true);
    setTranslationError(null);
    void adminFetch<AdminDestinationTranslation>(
      `/api/admin/destinations/${destinationId}/translations/am`,
    )
      .then((result) => {
        if (!active) return;
        setTranslation(result);
        setTranslationForm(toTranslationForm(result));
      })
      .catch((cause: unknown) => {
        if (!active) return;
        if (cause instanceof AdminFetchError && cause.status === 404) {
          setTranslation(null);
          setTranslationForm(emptyTranslation);
          return;
        }
        setTranslationError(t('translationLoadError'));
      })
      .finally(() => active && setTranslationLoading(false));
    return () => {
      active = false;
    };
  }, [destinationId, t]);

  function update(key: keyof Form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function updateTranslation(key: keyof TranslationForm, value: string) {
    setTranslationForm((current) => ({ ...current, [key]: value }));
  }

  function selectTab(next: EditorTab) {
    setActiveTab(next);
    setTranslationError(null);
  }

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!item) return;
    const tabs: EditorTab[] = ['english', 'amharic'];
    const currentIndex = tabs.indexOf(activeTab);
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight')
      nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === 'ArrowLeft')
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === 'Home') nextIndex = 0;
    if (event.key === 'End') nextIndex = tabs.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const next = tabs[nextIndex];
    if (!next) return;
    selectTab(next);
    event.currentTarget.ownerDocument
      .getElementById(`destination-editor-tab-${next}`)
      ?.focus();
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const result = await adminFetch<AdminDestination>(
        destinationId
          ? `/api/admin/destinations/${destinationId}`
          : '/api/admin/destinations',
        {
          body: JSON.stringify({
            ...form,
            slug: form.slug || undefined,
            latitude: Number(form.latitude),
            longitude: Number(form.longitude),
          }),
          method: destinationId ? 'PATCH' : 'POST',
        },
      );
      setItem(result);
      setForm(toForm(result));
      if (!destinationId) {
        router.replace(`/admin/destinations/${result.id}`);
      }
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : t('saveDestinationError'),
      );
    } finally {
      setSaving(false);
    }
  }

  async function publication() {
    if (!item || !confirm) return;
    setSaving(true);
    setError(null);
    try {
      const result = await adminFetch<AdminDestination>(
        `/api/admin/destinations/${item.id}/${confirm}`,
        { method: 'POST' },
      );
      setItem(result);
      setForm(toForm(result));
      setConfirm(null);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : t('publicationChangeError'),
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveTranslationDraft(): Promise<AdminDestinationTranslation | null> {
    if (!item) return null;
    const body = {
      bestTimeToVisit: optionalText(translationForm.bestTimeToVisit),
      displayName: optionalText(translationForm.displayName),
      fullDescription: optionalText(translationForm.fullDescription),
      gettingThere: optionalText(translationForm.gettingThere),
      localTips: optionalText(translationForm.localTips),
      safetyNotes: optionalText(translationForm.safetyNotes),
      shortDescription: optionalText(translationForm.shortDescription),
    };
    const result = await adminFetch<AdminDestinationTranslation>(
      `/api/admin/destinations/${item.id}/translations/am`,
      { body: JSON.stringify(body), method: 'PUT' },
    );
    setTranslation(result);
    setTranslationForm(toTranslationForm(result));
    return result;
  }

  async function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setTranslationError(null);
    setTranslationNotice(null);
    try {
      await saveTranslationDraft();
      setTranslationNotice(t('translationDraftSaved'));
    } catch {
      setTranslationError(t('translationSaveError'));
    } finally {
      setSaving(false);
    }
  }

  function requestTranslationAction(action: TranslationAction) {
    setTranslationError(null);
    setTranslationNotice(null);
    if (action === 'publish' && !translationIsComplete(translationForm)) {
      setTranslationError(t('translationRequiredContent'));
      return;
    }
    setTranslationConfirm(action);
  }

  async function applyTranslationAction() {
    if (!item || !translationConfirm) return;
    const action = translationConfirm;
    setSaving(true);
    setTranslationError(null);
    setTranslationNotice(null);
    try {
      if (action === 'publish') {
        await saveTranslationDraft();
      }
      const result = await adminFetch<AdminDestinationTranslation>(
        `/api/admin/destinations/${item.id}/translations/am/${action}`,
        { method: 'POST' },
      );
      setTranslation(result);
      setTranslationForm(toTranslationForm(result));
      setTranslationNotice(
        action === 'publish'
          ? t('translationPublished')
          : t('translationUnpublished'),
      );
      setTranslationConfirm(null);
    } catch {
      setTranslationError(
        action === 'publish'
          ? t('translationPublishError')
          : t('translationUnpublishError'),
      );
    } finally {
      setSaving(false);
    }
  }

  const translationPublic = Boolean(
    translation?.isPublished &&
    translationIsComplete(toTranslationForm(translation)),
  );
  const previewName =
    translationPublic && optionalText(translation?.displayName ?? '')
      ? optionalText(translation?.displayName ?? '')!
      : (item?.name ?? '');
  const previewShortDescription =
    translationPublic && optionalText(translation?.shortDescription ?? '')
      ? optionalText(translation?.shortDescription ?? '')!
      : (item?.shortDescription ?? '');
  const previewFullDescription =
    translationPublic && optionalText(translation?.fullDescription ?? '')
      ? optionalText(translation?.fullDescription ?? '')!
      : (item?.fullDescription ?? '');
  const previewGuidance = item
    ? (
        [
          ['bestTimeToVisit', 'translationBestTimeToVisit'],
          ['gettingThere', 'translationGettingThere'],
          ['localTips', 'translationLocalTips'],
          ['safetyNotes', 'translationSafetyNotes'],
        ] as const
      )
        .map(([field, label]) => ({
          label: t(label),
          value:
            translationPublic && optionalText(translation?.[field] ?? '')
              ? optionalText(translation?.[field] ?? '')
              : canonicalTravelText(item, field),
        }))
        .filter((entry): entry is { label: string; value: string } =>
          Boolean(entry.value),
        )
    : [];

  if (loading)
    return <p className="text-slate-600">{t('loadingDestination')}</p>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
            {t('destinationCms')}
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">
            {item?.name ?? t('createDestination')}
          </h1>
          {item ? (
            <span
              className={`mt-2 inline-block rounded-md px-2 py-1 text-xs font-semibold ${statusClass(item.status)}`}
            >
              {item.status}
            </span>
          ) : null}
        </div>
        {item && !editable ? (
          <Link
            href={`/admin/destinations/${item.id}/edit`}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800"
          >
            {t('editDestination')}
          </Link>
        ) : null}
      </header>
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
          {error}
        </p>
      ) : null}

      {item ? (
        <div
          role="tablist"
          aria-label={t('destinationContentLanguage')}
          className="flex w-full overflow-x-auto border-b border-slate-200"
        >
          {(
            [
              ['english', t('destinationEnglishTab')],
              ['amharic', t('destinationAmharicTab')],
            ] as const
          ).map(([tab, label]) => (
            <button
              key={tab}
              id={`destination-editor-tab-${tab}`}
              type="button"
              role="tab"
              aria-controls={`destination-editor-panel-${tab}`}
              aria-selected={activeTab === tab}
              tabIndex={activeTab === tab ? 0 : -1}
              onClick={() => selectTab(tab)}
              onKeyDown={handleTabKeyDown}
              className={`min-h-11 shrink-0 border-b-2 px-4 py-2 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 ${
                activeTab === tab
                  ? 'border-emerald-700 text-emerald-800'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}

      {activeTab === 'english' ? (
        <section
          id={item ? 'destination-editor-panel-english' : undefined}
          role={item ? 'tabpanel' : undefined}
          aria-labelledby={item ? 'destination-editor-tab-english' : undefined}
        >
          {editable ? (
            <form
              onSubmit={(event) => {
                void save(event);
              }}
              className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-800">
                  {t('destinationName')}
                  <input
                    required
                    maxLength={180}
                    value={form.name}
                    onChange={(event) => update('name', event.target.value)}
                    className="mt-1 block min-h-10 w-full rounded-md border border-slate-300 px-3 font-normal"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-800">
                  {t('slug')}{' '}
                  <span className="font-normal text-slate-500">
                    ({t('optional')})
                  </span>
                  <input
                    maxLength={200}
                    value={form.slug}
                    onChange={(event) => update('slug', event.target.value)}
                    className="mt-1 block min-h-10 w-full rounded-md border border-slate-300 px-3 font-normal"
                  />
                </label>
              </div>
              <label className="block text-sm font-semibold text-slate-800">
                {t('city')}
                <select
                  required
                  value={form.cityId}
                  onChange={(event) => update('cityId', event.target.value)}
                  className="mt-1 block min-h-10 w-full rounded-md border border-slate-300 px-3 font-normal"
                >
                  <option value="">{t('selectCity')}</option>
                  {cities.map((city) => (
                    <option key={city.id} value={city.id}>
                      {city.name} ({city.status})
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-semibold text-slate-800">
                {t('shortDescription')}
                <textarea
                  required
                  rows={3}
                  maxLength={300}
                  value={form.shortDescription}
                  onChange={(event) =>
                    update('shortDescription', event.target.value)
                  }
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
                />
              </label>
              <label className="block text-sm font-semibold text-slate-800">
                {t('fullDescription')}
                <textarea
                  required
                  rows={8}
                  maxLength={20000}
                  value={form.fullDescription}
                  onChange={(event) =>
                    update('fullDescription', event.target.value)
                  }
                  className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
                />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold text-slate-800">
                  {t('latitude')}
                  <input
                    required
                    type="number"
                    min="-90"
                    max="90"
                    step="0.000001"
                    value={form.latitude}
                    onChange={(event) => update('latitude', event.target.value)}
                    className="mt-1 block min-h-10 w-full rounded-md border border-slate-300 px-3 font-normal"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-800">
                  {t('longitude')}
                  <input
                    required
                    type="number"
                    min="-180"
                    max="180"
                    step="0.000001"
                    value={form.longitude}
                    onChange={(event) =>
                      update('longitude', event.target.value)
                    }
                    className="mt-1 block min-h-10 w-full rounded-md border border-slate-300 px-3 font-normal"
                  />
                </label>
              </div>
              <div className="flex justify-end gap-3">
                <Link
                  href="/admin/destinations"
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
                >
                  {t('cancel')}
                </Link>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? t('saving') : t('saveDraft')}
                </button>
              </div>
            </form>
          ) : item ? (
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-slate-700">{item.fullDescription}</p>
              <p className="mt-4 text-sm text-slate-600">
                {t('coordinates', {
                  latitude: item.latitude,
                  longitude: item.longitude,
                })}
              </p>
            </section>
          ) : null}
        </section>
      ) : item ? (
        <section
          id="destination-editor-panel-amharic"
          role="tabpanel"
          aria-labelledby="destination-editor-tab-amharic"
          className="space-y-5"
        >
          {translationLoading ? (
            <p className="text-slate-600">{t('loadingTranslation')}</p>
          ) : (
            <>
              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-bold text-slate-950">
                      {t('destinationAmharicTranslation')}
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {translation?.isPublished
                        ? t('translationPublishedStatus')
                        : translation
                          ? t('translationDraftStatus')
                          : t('translationNotCreatedStatus')}
                    </p>
                  </div>
                  <span
                    className={`rounded-md px-2 py-1 text-xs font-semibold ${
                      translation?.isPublished
                        ? 'bg-emerald-50 text-emerald-800'
                        : 'bg-amber-50 text-amber-900'
                    }`}
                  >
                    {translation?.isPublished
                      ? t('translationPublishedLabel')
                      : translation
                        ? t('translationDraftLabel')
                        : t('translationNotCreatedLabel')}
                  </span>
                </div>
                {!translationPublic ? (
                  <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
                    {t('translationFallbackNotice')}
                  </p>
                ) : null}
              </section>

              {translationError ? (
                <p
                  role="alert"
                  className="rounded-lg bg-red-50 p-4 text-red-800"
                >
                  {translationError}
                </p>
              ) : null}
              {translationNotice ? (
                <p
                  role="status"
                  className="rounded-lg bg-emerald-50 p-4 text-emerald-900"
                >
                  {translationNotice}
                </p>
              ) : null}

              {editable ? (
                <form
                  onSubmit={(event) => {
                    void saveDraft(event);
                  }}
                  className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <p className="text-sm text-slate-600">
                    {t('translationSaveDraftNotice')}
                  </p>
                  <label className="block text-sm font-semibold text-slate-800">
                    {t('translationDisplayName')}{' '}
                    <span className="font-normal text-slate-500">
                      ({t('optional')})
                    </span>
                    <input
                      maxLength={180}
                      value={translationForm.displayName}
                      onChange={(event) =>
                        updateTranslation('displayName', event.target.value)
                      }
                      className="mt-1 block min-h-10 w-full rounded-md border border-slate-300 px-3 font-normal"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-slate-800">
                    {t('shortDescription')}
                    <textarea
                      rows={3}
                      maxLength={300}
                      value={translationForm.shortDescription}
                      onChange={(event) =>
                        updateTranslation(
                          'shortDescription',
                          event.target.value,
                        )
                      }
                      aria-describedby="translation-required-content"
                      className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-slate-800">
                    {t('fullDescription')}
                    <textarea
                      rows={8}
                      maxLength={20000}
                      value={translationForm.fullDescription}
                      onChange={(event) =>
                        updateTranslation('fullDescription', event.target.value)
                      }
                      aria-describedby="translation-required-content"
                      className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
                    />
                  </label>
                  <p
                    id="translation-required-content"
                    className="text-sm text-slate-600"
                  >
                    {t('translationPublishRequirement')}
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    {(
                      [
                        ['bestTimeToVisit', 'translationBestTimeToVisit'],
                        ['gettingThere', 'translationGettingThere'],
                        ['localTips', 'translationLocalTips'],
                        ['safetyNotes', 'translationSafetyNotes'],
                      ] as const
                    ).map(([field, label]) => (
                      <label
                        key={field}
                        className="block text-sm font-semibold text-slate-800"
                      >
                        {t(label)}{' '}
                        <span className="font-normal text-slate-500">
                          ({t('optional')})
                        </span>
                        <textarea
                          rows={3}
                          maxLength={1000}
                          value={translationForm[field]}
                          onChange={(event) =>
                            updateTranslation(field, event.target.value)
                          }
                          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-normal"
                        />
                      </label>
                    ))}
                  </div>
                  <div className="flex flex-wrap justify-end gap-3">
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 disabled:opacity-60"
                    >
                      {saving ? t('saving') : t('saveTranslationDraft')}
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => requestTranslationAction('publish')}
                      className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {t('publishTranslation')}
                    </button>
                    {translation ? (
                      <button
                        type="button"
                        disabled={saving || !translation.isPublished}
                        onClick={() => requestTranslationAction('unpublish')}
                        className="rounded-md border border-amber-700 px-4 py-2 text-sm font-semibold text-amber-900 disabled:opacity-60"
                      >
                        {t('unpublishTranslation')}
                      </button>
                    ) : null}
                  </div>
                </form>
              ) : null}

              {translationConfirm ? (
                <section
                  role="alertdialog"
                  aria-modal="false"
                  aria-labelledby="translation-confirmation-title"
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setTranslationConfirm(null);
                  }}
                  className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950"
                >
                  <h2 id="translation-confirmation-title" className="font-bold">
                    {translationConfirm === 'publish'
                      ? t('publishTranslation')
                      : t('unpublishTranslation')}
                  </h2>
                  <p className="mt-2 text-sm">
                    {translationConfirm === 'publish'
                      ? t('confirmPublishTranslation')
                      : t('confirmUnpublishTranslation')}
                  </p>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => {
                        void applyTranslationAction();
                      }}
                      autoFocus
                      className="rounded-md bg-emerald-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {t('confirm')}
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setTranslationConfirm(null)}
                      className="rounded-md border border-amber-700 px-3 py-2 text-sm font-semibold"
                    >
                      {t('cancel')}
                    </button>
                  </div>
                </section>
              ) : null}

              <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-lg font-bold text-slate-950">
                  {t('translationPreview')}
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  {translationPublic
                    ? t('translationPreviewPublished')
                    : t('translationPreviewFallback')}
                </p>
                <div className="mt-4 space-y-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-950">
                      {previewName}
                    </h3>
                    <p className="mt-1 font-medium text-slate-700">
                      {previewShortDescription}
                    </p>
                  </div>
                  <p className="whitespace-pre-wrap text-slate-700">
                    {previewFullDescription}
                  </p>
                  {previewGuidance.length ? (
                    <dl className="grid gap-3 sm:grid-cols-2">
                      {previewGuidance.map(({ label, value }) => (
                        <div key={label}>
                          <dt className="text-sm font-semibold text-slate-800">
                            {label}
                          </dt>
                          <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-700">
                            {value}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : null}
                </div>
              </section>
            </>
          )}
        </section>
      ) : null}

      {item && item.status !== 'ARCHIVED' ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">
            {t('publication')}
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            {t('destinationPublicationHelp')}
          </p>
          {confirm ? (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
              <span>
                {t('confirmPublication', { action: confirm, name: item.name })}
              </span>
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  void publication();
                }}
                className="rounded-md bg-emerald-700 px-3 py-2 font-semibold text-white disabled:opacity-60"
              >
                {t('confirmAction', { action: confirm })}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => setConfirm(null)}
                className="rounded-md border border-slate-300 px-3 py-2 font-semibold"
              >
                {t('cancel')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={saving}
              onClick={() =>
                setConfirm(
                  item.status === 'PUBLISHED' ? 'unpublish' : 'publish',
                )
              }
              className="mt-4 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-800"
            >
              {item.status === 'PUBLISHED'
                ? t('unpublishDestination')
                : t('publishDestination')}
            </button>
          )}
        </section>
      ) : null}
    </div>
  );
}
