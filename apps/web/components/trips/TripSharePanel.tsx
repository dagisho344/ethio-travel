'use client';

import {
  Copy,
  Eye,
  Link2,
  LoaderCircle,
  RotateCw,
  ShieldOff,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { BffRequestError, bffJson } from '../../lib/private-api';
import { formatTripDate, formatTripDateRange } from '../../lib/trips';
import type {
  SharedTrip,
  TripShareOwnerMetadata,
  TripShareState,
} from '../../lib/types';

type ShareSecret = { token: string; expiresAt: string | null };

const stateLabels: Record<TripShareState, string> = {
  NONE: 'No sharing link',
  ACTIVE: 'Sharing link active',
  EXPIRED: 'Sharing link expired',
  REVOKED: 'Sharing link revoked',
  ARCHIVED: 'Sharing unavailable for archived trips',
};

function requestMessage(error: unknown, fallback: string): string {
  return error instanceof BffRequestError ? error.message : fallback;
}

function toExpiryPayload(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toLocalDateTimeInput(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetDate = new Date(
    date.getTime() - date.getTimezoneOffset() * 60_000,
  );
  return offsetDate.toISOString().slice(0, 16);
}

export function TripSharePanel({
  tripId,
  readOnly,
}: {
  tripId: string;
  readOnly: boolean;
}) {
  const [metadata, setMetadata] = useState<TripShareOwnerMetadata | null>(null);
  const [preview, setPreview] = useState<SharedTrip | null>(null);
  const [expiry, setExpiry] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadMetadata = async () => {
    const result = await bffJson<TripShareOwnerMetadata>(
      `/api/trips/${tripId}/share`,
    );
    setMetadata(result);
    setExpiry(toLocalDateTimeInput(result.expiresAt));
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void loadMetadata()
      .catch((requestError: unknown) => {
        if (active) {
          setMetadata(null);
          setError(requestMessage(requestError, 'We could not load sharing.'));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [tripId]);

  async function loadPreview() {
    setBusy(true);
    setError(null);
    setMessage(null);
    setConfirmed(false);
    try {
      setPreview(
        await bffJson<SharedTrip>(`/api/trips/${tripId}/share/preview`),
      );
      setMessage(
        'Review the exact public itinerary below before enabling sharing.',
      );
    } catch (requestError) {
      setPreview(null);
      setError(
        requestMessage(requestError, 'We could not prepare this preview.'),
      );
    } finally {
      setBusy(false);
    }
  }

  async function enableSharing(regenerate: boolean) {
    if (!preview || !confirmed) return;
    const expiresAt = toExpiryPayload(expiry);
    if (expiry && !expiresAt) {
      setError('Enter a valid future expiration or leave it blank.');
      return;
    }
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const secret = await bffJson<ShareSecret>(
        `/api/trips/${tripId}/share${regenerate ? '/regenerate' : ''}`,
        {
          method: 'POST',
          body: JSON.stringify({ expiresAt }),
        },
      );
      setShareUrl(`${window.location.origin}/shared-trip#${secret.token}`);
      await loadMetadata();
      setMessage(
        'Copy this link now. For security, it is not shown again after you leave this page.',
      );
    } catch (requestError) {
      setError(requestMessage(requestError, 'We could not create the link.'));
    } finally {
      setBusy(false);
    }
  }

  async function updateExpiry() {
    const expiresAt = toExpiryPayload(expiry);
    if (expiry && !expiresAt) {
      setError('Enter a valid future expiration or leave it blank.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await bffJson<TripShareOwnerMetadata>(`/api/trips/${tripId}/share`, {
        method: 'PATCH',
        body: JSON.stringify({ expiresAt }),
      });
      await loadMetadata();
      setMessage('Share-link expiration updated.');
    } catch (requestError) {
      setError(requestMessage(requestError, 'We could not update expiration.'));
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    if (
      !window.confirm(
        'Revoke this sharing link? Anyone with it will lose access.',
      )
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await bffJson<void>(`/api/trips/${tripId}/share/revoke`, {
        method: 'POST',
      });
      setShareUrl(null);
      setPreview(null);
      setConfirmed(false);
      await loadMetadata();
      setMessage('Sharing link revoked.');
    } catch (requestError) {
      setError(requestMessage(requestError, 'We could not revoke the link.'));
    } finally {
      setBusy(false);
    }
  }

  async function copyShareUrl() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setMessage('Sharing link copied.');
    } catch {
      setError(
        'Copy failed. Select and copy the link manually before leaving.',
      );
    }
  }

  if (loading) {
    return (
      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-500 shadow-sm">
        Loading sharing controls...
      </section>
    );
  }

  const archived = readOnly || metadata?.state === 'ARCHIVED';
  const shouldRegenerate = metadata ? metadata.state !== 'NONE' : false;
  return (
    <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-950">
            <Link2 className="h-5 w-5 text-highland" aria-hidden="true" />
            Share this trip
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-600">
            Sharing includes only currently public destinations, attractions,
            businesses, and services. Bookings, custom items, notes, budget, and
            account information are never shared.
          </p>
        </div>
        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
          {metadata ? stateLabels[metadata.state] : 'Sharing unavailable'}
        </span>
      </div>

      {archived ? (
        <p className="mt-4 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
          Archived trips cannot enable sharing. Existing links remain
          unavailable and may still be revoked.
        </p>
      ) : (
        <>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="text-sm font-medium text-slate-700">
              Optional link expiration
              <input
                type="datetime-local"
                value={expiry}
                disabled={busy}
                onChange={(event) => setExpiry(event.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-slate-900 focus:border-highland focus:outline-none focus:ring-2 focus:ring-highland/20"
              />
            </label>
            {metadata?.state === 'ACTIVE' ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void updateExpiry()}
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-highland hover:text-highland disabled:opacity-60"
              >
                Save expiration
              </button>
            ) : null}
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void loadPreview()}
            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md border border-highland px-4 py-2 text-sm font-semibold text-highland hover:bg-emerald-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-offset-2 disabled:opacity-60"
          >
            {busy ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            Preview shared itinerary
          </button>
        </>
      )}

      {preview ? (
        <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
          <h3 className="font-bold text-slate-950">Public preview</h3>
          <p className="mt-1 text-sm text-slate-700">
            {preview.title} ·{' '}
            {formatTripDateRange(preview.startDate, preview.endDate)}
          </p>
          {preview.destinations.map((destination) => (
            <p
              key={`${destination.name}-${destination.cityName}`}
              className="mt-1 text-sm text-slate-600"
            >
              {destination.name} · {destination.cityName},{' '}
              {destination.regionName}
            </p>
          ))}
          <ol className="mt-4 space-y-3" aria-label="Shared itinerary preview">
            {preview.days.map((day) => (
              <li key={`${day.date}-${day.dayNumber}`}>
                <p className="text-sm font-semibold text-slate-800">
                  Day {day.dayNumber} · {formatTripDate(day.date)}
                </p>
                {day.items.length ? (
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                    {day.items.map((item, index) => (
                      <li key={`${item.type}-${item.title}-${index}`}>
                        {item.title}
                        {item.startTime ? ` · ${item.startTime}` : ''}
                        {item.endTime ? `–${item.endTime}` : ''}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-slate-500">
                    No eligible public items for this day.
                  </p>
                )}
              </li>
            ))}
          </ol>
          {preview.truncated ? (
            <p className="mt-3 text-sm text-amber-900">
              This preview is safely capped; additional itinerary items are not
              included in the shared view.
            </p>
          ) : null}
          {!archived ? (
            <label className="mt-4 flex items-start gap-2 text-sm font-medium text-slate-800">
              <input
                type="checkbox"
                checked={confirmed}
                disabled={busy}
                onChange={(event) => setConfirmed(event.target.checked)}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-highland focus:ring-highland"
              />
              I reviewed this exact filtered itinerary and want to enable
              sharing.
            </label>
          ) : null}
          {!archived ? (
            <button
              type="button"
              disabled={busy || !confirmed}
              onClick={() => void enableSharing(shouldRegenerate)}
              className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-md bg-highland px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-offset-2 disabled:opacity-60"
            >
              {busy ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : shouldRegenerate ? (
                <RotateCw className="h-4 w-4" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              {shouldRegenerate
                ? 'Generate replacement link'
                : 'Create sharing link'}
            </button>
          ) : null}
        </div>
      ) : null}

      {shareUrl ? (
        <div className="mt-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
          <label
            className="text-sm font-semibold text-slate-800"
            htmlFor="trip-share-link"
          >
            Copy this one-time sharing link
          </label>
          <div className="mt-2 flex flex-col gap-2 sm:flex-row">
            <input
              id="trip-share-link"
              readOnly
              value={shareUrl}
              className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
            />
            <button
              type="button"
              onClick={() => void copyShareUrl()}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-highland hover:text-highland"
            >
              <Copy className="h-4 w-4" aria-hidden="true" />
              Copy
            </button>
          </div>
        </div>
      ) : null}

      {metadata?.canRevoke ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => void revoke()}
          className="mt-5 inline-flex min-h-10 items-center gap-2 rounded-md border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-60"
        >
          <ShieldOff className="h-4 w-4" aria-hidden="true" />
          Revoke sharing link
        </button>
      ) : null}
      {message ? (
        <p className="mt-4 text-sm text-emerald-800" role="status">
          {message}
        </p>
      ) : null}
      {error ? (
        <p
          className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900"
          role="alert"
        >
          {error}
        </p>
      ) : null}
    </section>
  );
}
