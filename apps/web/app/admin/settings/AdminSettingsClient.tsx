'use client';

import { FormEvent, useEffect, useState } from 'react';
import { formatDate, type PlatformSettings } from '../../../lib/admin';

const emptySettings: PlatformSettings = {
  supportEmail: null,
  supportMessage: null,
  supportPhone: null,
  updatedAt: null,
};

export function AdminSettingsClient() {
  const [settings, setSettings] = useState<PlatformSettings>(emptySettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch('/api/admin/settings', {
          cache: 'no-store',
        });
        if (!response.ok) throw new Error('Request failed');
        setSettings((await response.json()) as PlatformSettings);
      } catch {
        setError('We could not load platform settings right now.');
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          supportEmail: settings.supportEmail || null,
          supportMessage: settings.supportMessage || null,
          supportPhone: settings.supportPhone || null,
        }),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message =
          typeof payload === 'object' &&
          payload !== null &&
          typeof (payload as { message?: unknown }).message === 'string'
            ? (payload as { message: string }).message
            : 'We could not save platform settings.';
        throw new Error(message);
      }
      setSettings(payload as PlatformSettings);
      setSuccess('Platform settings saved.');
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : 'We could not save platform settings.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-slate-600">Loading settings…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
          System
        </p>
        <h1 className="mt-1 text-3xl font-bold text-slate-950">
          Platform settings
        </h1>
        <p className="mt-2 text-slate-600">
          Manage typed public support contact information. Environment secrets,
          payment credentials, and infrastructure configuration are never stored
          here.
        </p>
      </header>
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 p-4 text-red-800">
          {error}
        </p>
      ) : null}
      {success ? (
        <p
          role="status"
          className="rounded-lg bg-emerald-50 p-4 text-emerald-900"
        >
          {success}
        </p>
      ) : null}
      <form
        onSubmit={(event) => {
          void save(event);
        }}
        className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div>
          <label
            htmlFor="support-email"
            className="text-sm font-semibold text-slate-800"
          >
            Support email
          </label>
          <input
            id="support-email"
            type="email"
            maxLength={254}
            value={settings.supportEmail ?? ''}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                supportEmail: event.target.value,
              }))
            }
            className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label
            htmlFor="support-phone"
            className="text-sm font-semibold text-slate-800"
          >
            Support phone
          </label>
          <input
            id="support-phone"
            type="tel"
            maxLength={50}
            value={settings.supportPhone ?? ''}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                supportPhone: event.target.value,
              }))
            }
            className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label
            htmlFor="support-message"
            className="text-sm font-semibold text-slate-800"
          >
            Public support message
          </label>
          <textarea
            id="support-message"
            maxLength={500}
            rows={4}
            value={settings.supportMessage ?? ''}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                supportMessage: event.target.value,
              }))
            }
            className="mt-1.5 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <p className="mt-1 text-xs text-slate-500">
            Do not enter passwords, tokens, payment credentials, or private
            documents.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-4">
          <p className="text-xs text-slate-500">
            Last updated: {formatDate(settings.updatedAt)}
          </p>
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-emerald-800 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </form>
    </div>
  );
}
