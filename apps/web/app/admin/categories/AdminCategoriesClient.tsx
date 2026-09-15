'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  AdminCategory,
  AdminPage,
  adminFetch,
  statusClass,
} from '../../../lib/admin';

type Form = {
  code: string;
  name: string;
  description: string;
  sortOrder: string;
  isActive: boolean;
};
const empty: Form = {
  code: '',
  name: '',
  description: '',
  sortOrder: '0',
  isActive: true,
};

function CategoryPanel({
  endpoint,
  title,
}: {
  endpoint: string;
  title: string;
}) {
  const [page, setPage] = useState<AdminPage<AdminCategory> | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  function load() {
    void adminFetch<AdminPage<AdminCategory>>(`${endpoint}?limit=100`)
      .then(setPage)
      .catch((cause: unknown) =>
        setError(
          cause instanceof Error
            ? cause.message
            : 'Categories are unavailable.',
        ),
      );
  }
  useEffect(load, [endpoint]);
  function update(key: keyof Form, value: string | boolean) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await adminFetch(editing ? `${endpoint}/${editing}` : endpoint, {
        body: JSON.stringify({
          ...form,
          description: form.description || undefined,
          sortOrder: Number(form.sortOrder),
        }),
        method: editing ? 'PATCH' : 'POST',
      });
      setForm(empty);
      setEditing(null);
      load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Category could not be saved.',
      );
    } finally {
      setSaving(false);
    }
  }

  function edit(item: AdminCategory) {
    setEditing(item.id);
    setForm({
      code: item.code,
      name: item.name,
      description: item.description ?? '',
      sortOrder: String(item.sortOrder),
      isActive: item.isActive,
    });
  }

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-xl font-bold text-slate-950">{title}</h2>
        <p className="mt-1 text-sm text-slate-600">
          Referenced categories are never deleted; deactivate them instead.
        </p>
      </div>
      {error ? (
        <p role="alert" className="rounded bg-red-50 p-3 text-sm text-red-800">
          {error}
        </p>
      ) : null}
      <form
        onSubmit={(event) => {
          void submit(event);
        }}
        className="grid gap-3 sm:grid-cols-2"
      >
        <label className="text-sm font-semibold">
          Code
          <input
            required
            maxLength={80}
            value={form.code}
            onChange={(event) => update('code', event.target.value)}
            className="mt-1 block min-h-10 w-full rounded border border-slate-300 px-3 font-normal"
          />
        </label>
        <label className="text-sm font-semibold">
          Name
          <input
            required
            maxLength={120}
            value={form.name}
            onChange={(event) => update('name', event.target.value)}
            className="mt-1 block min-h-10 w-full rounded border border-slate-300 px-3 font-normal"
          />
        </label>
        <label className="text-sm font-semibold sm:col-span-2">
          Description{' '}
          <span className="font-normal text-slate-500">(optional)</span>
          <input
            maxLength={2000}
            value={form.description}
            onChange={(event) => update('description', event.target.value)}
            className="mt-1 block min-h-10 w-full rounded border border-slate-300 px-3 font-normal"
          />
        </label>
        <label className="text-sm font-semibold">
          Sort order
          <input
            required
            type="number"
            min="0"
            value={form.sortOrder}
            onChange={(event) => update('sortOrder', event.target.value)}
            className="mt-1 block min-h-10 w-full rounded border border-slate-300 px-3 font-normal"
          />
        </label>
        <label className="flex min-h-10 items-center gap-2 self-end text-sm font-semibold">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(event) => update('isActive', event.target.checked)}
          />
          Active for new assignments
        </label>
        <div className="flex gap-3 sm:col-span-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {saving
              ? 'Saving…'
              : editing
                ? 'Update category'
                : 'Create category'}
          </button>
          {editing ? (
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setForm(empty);
              }}
              className="rounded border border-slate-300 px-4 py-2 text-sm font-semibold"
            >
              Cancel edit
            </button>
          ) : null}
        </div>
      </form>
      <div className="divide-y divide-slate-100">
        {page?.data.map((item) => (
          <div
            key={item.id}
            className="flex items-center justify-between gap-4 py-3"
          >
            <div>
              <p className="font-semibold text-slate-950">
                {item.name}{' '}
                <span className="font-normal text-slate-500">
                  ({item.code})
                </span>
              </p>
              <p className="text-sm text-slate-600">
                {item.description ?? 'No description'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`rounded px-2 py-1 text-xs font-semibold ${statusClass(item.isActive ? 'ACTIVE' : 'INACTIVE')}`}
              >
                {item.isActive ? 'ACTIVE' : 'INACTIVE'}
              </span>
              <button
                type="button"
                onClick={() => edit(item)}
                className="text-sm font-semibold text-emerald-800"
              >
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function AdminCategoriesClient() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
          Content management
        </p>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">Categories</h1>
        <p className="mt-2 text-slate-600">
          Business and service categories remain separate domain systems.
        </p>
      </header>
      <div className="grid gap-6 xl:grid-cols-2">
        <CategoryPanel
          endpoint="/api/admin/categories/business"
          title="Business Categories"
        />
        <CategoryPanel
          endpoint="/api/admin/categories/service"
          title="Service Categories"
        />
      </div>
    </div>
  );
}
