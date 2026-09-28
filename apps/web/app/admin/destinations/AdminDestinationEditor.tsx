'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  AdminCity,
  AdminDestination,
  AdminPage,
  adminFetch,
  statusClass,
} from '../../../lib/admin';

type Form = {
  cityId: string;
  name: string;
  slug: string;
  shortDescription: string;
  fullDescription: string;
  latitude: string;
  longitude: string;
};
const empty: Form = {
  cityId: '',
  name: '',
  slug: '',
  shortDescription: '',
  fullDescription: '',
  latitude: '',
  longitude: '',
};
const toForm = (item: AdminDestination): Form => ({
  cityId: item.cityId,
  name: item.name,
  slug: item.slug,
  shortDescription: item.shortDescription,
  fullDescription: item.fullDescription,
  latitude: String(item.latitude),
  longitude: String(item.longitude),
});

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
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [confirm, setConfirm] = useState<'publish' | 'unpublish' | null>(null);

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
  }, [destinationId]);

  function update(key: keyof Form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
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
                onChange={(event) => update('longitude', event.target.value)}
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
