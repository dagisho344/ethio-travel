'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useState } from 'react';
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
              : 'Destination is unavailable.',
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
        cause instanceof Error
          ? cause.message
          : 'Destination could not be saved.',
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
        cause instanceof Error
          ? cause.message
          : 'Publication state could not be changed.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-slate-600">Loading destination…</p>;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
            Destination CMS
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">
            {item?.name ?? 'Create destination'}
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
            Edit destination
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
          onSubmit={save}
          className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-800">
              Name
              <input
                required
                maxLength={180}
                value={form.name}
                onChange={(event) => update('name', event.target.value)}
                className="mt-1 block min-h-10 w-full rounded-md border border-slate-300 px-3 font-normal"
              />
            </label>
            <label className="text-sm font-semibold text-slate-800">
              Slug{' '}
              <span className="font-normal text-slate-500">(optional)</span>
              <input
                maxLength={200}
                value={form.slug}
                onChange={(event) => update('slug', event.target.value)}
                className="mt-1 block min-h-10 w-full rounded-md border border-slate-300 px-3 font-normal"
              />
            </label>
          </div>
          <label className="block text-sm font-semibold text-slate-800">
            City
            <select
              required
              value={form.cityId}
              onChange={(event) => update('cityId', event.target.value)}
              className="mt-1 block min-h-10 w-full rounded-md border border-slate-300 px-3 font-normal"
            >
              <option value="">Select a city</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name} ({city.status})
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-800">
            Short description
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
            Full description
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
              Latitude
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
              Longitude
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
              Cancel
            </Link>
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? 'Saving…' : 'Save draft'}
            </button>
          </div>
        </form>
      ) : item ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-slate-700">{item.fullDescription}</p>
          <p className="mt-4 text-sm text-slate-600">
            Coordinates: {item.latitude}, {item.longitude}
          </p>
        </section>
      ) : null}
      {item && item.status !== 'ARCHIVED' ? (
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">Publication</h2>
          <p className="mt-2 text-sm text-slate-600">
            Saving edits never publishes this destination. Confirm publication
            separately after review.
          </p>
          {confirm ? (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
              <span>
                Confirm {confirm} for {item.name}?
              </span>
              <button
                type="button"
                disabled={saving}
                onClick={publication}
                className="rounded-md bg-emerald-700 px-3 py-2 font-semibold text-white disabled:opacity-60"
              >
                Confirm {confirm}
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => setConfirm(null)}
                className="rounded-md border border-slate-300 px-3 py-2 font-semibold"
              >
                Cancel
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
                ? 'Unpublish destination'
                : 'Publish destination'}
            </button>
          )}
        </section>
      ) : null}
    </div>
  );
}
