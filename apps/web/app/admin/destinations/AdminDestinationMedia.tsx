'use client';

import Image from 'next/image';
import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  AdminDestinationMedia as Media,
  AdminFetchError,
  AdminPage,
  adminFetch,
} from '../../../lib/admin';

const maxImageBytes = 10 * 1024 * 1024;
const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

export function AdminDestinationMedia({
  destinationId,
  destinationName,
  archived,
}: {
  destinationId: string;
  destinationName: string;
  archived: boolean;
}) {
  const t = useTranslations('adminPortal.destinationMedia');
  const [items, setItems] = useState<Media[]>([]);
  const [nextPage, setNextPage] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [role, setRole] = useState<'HERO' | 'GALLERY'>('GALLERY');
  const [file, setFile] = useState<File | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const archiveTriggers = useRef(new Map<string, HTMLButtonElement>());

  const path = `/api/admin/destinations/${destinationId}/media`;
  const loadPage = useCallback(
    async (page: number, append = false) => {
      const result = await adminFetch<AdminPage<Media>>(
        `${path}?page=${page}&limit=100`,
      );
      setItems((current) =>
        append ? [...current, ...result.data] : result.data,
      );
      setNextPage(page < result.meta.totalPages ? page + 1 : null);
    },
    [path],
  );

  useEffect(() => {
    setLoading(true);
    setError(null);
    void loadPage(1)
      .catch(() => setError(t('loadError')))
      .finally(() => setLoading(false));
  }, [loadPage, t]);

  async function runMutation(
    operation: () => Promise<unknown>,
    success: string,
    failure: string,
  ) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await operation();
      try {
        await loadPage(1);
        setNotice(success);
      } catch {
        setError(t('loadError'));
      }
    } catch (cause) {
      setError(
        cause instanceof AdminFetchError && cause.status === 409
          ? t('conflictError')
          : failure,
      );
      if (cause instanceof AdminFetchError && cause.status === 409) {
        try {
          await loadPage(1);
        } catch {
          // The conflict remains visible; Retry can load current server state.
        }
      }
    } finally {
      setBusy(false);
    }
  }

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (archived || busy) return;
    if (!file || !imageTypes.has(file.type) || file.size < 1) {
      setError(t('invalidImage'));
      return;
    }
    if (file.size > maxImageBytes) {
      setError(t('imageTooLarge'));
      return;
    }
    const data = new FormData(form);
    data.set('role', role);
    data.set('file', file, file.name);
    await runMutation(
      async () => {
        const response = await fetch(path, {
          method: 'POST',
          body: data,
          credentials: 'same-origin',
        });
        if (!response.ok)
          throw new AdminFetchError(t('uploadError'), response.status);
        setFile(null);
        form.reset();
      },
      t('uploaded'),
      t('uploadError'),
    );
  }

  function saveMetadata(event: FormEvent<HTMLFormElement>, mediaId: string) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const altText = values.get('altText');
    const caption = values.get('caption');
    void runMutation(
      () =>
        adminFetch(`${path}/${mediaId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            altText:
              (typeof altText === 'string' ? altText.trim() : '') || null,
            caption:
              (typeof caption === 'string' ? caption.trim() : '') || null,
          }),
        }),
      t('metadataSaved'),
      t('metadataError'),
    );
  }

  function archive(mediaId: string) {
    let archivedSuccessfully = false;
    void runMutation(
      async () => {
        await adminFetch(`${path}/${mediaId}/archive`, { method: 'POST' });
        archivedSuccessfully = true;
      },
      t('archived'),
      t('archiveError'),
    ).finally(() => {
      setConfirmArchive(null);
      if (archivedSuccessfully) headingRef.current?.focus();
      else archiveTriggers.current.get(mediaId)?.focus();
    });
  }

  function cancelArchive(mediaId: string) {
    archiveTriggers.current.get(mediaId)?.focus();
    setConfirmArchive(null);
  }

  function moveGallery(mediaId: string, offset: -1 | 1, gallery: Media[]) {
    if (nextPage !== null) return;
    const ids = gallery.map((item) => item.mediaId);
    const index = ids.indexOf(mediaId);
    const other = index + offset;
    if (index < 0 || other < 0 || other >= ids.length) return;
    [ids[index], ids[other]] = [ids[other]!, ids[index]!];
    void runMutation(
      () =>
        adminFetch(`${path}/reorder`, {
          method: 'POST',
          body: JSON.stringify({ mediaIds: ids }),
        }),
      t('reordered'),
      t('reorderError'),
    );
  }

  const hero = items.find(
    (item) => item.role === 'HERO' && item.status === 'READY',
  );
  const gallery = items
    .filter((item) => item.role === 'GALLERY' && item.status === 'READY')
    .sort((a, b) => a.sortOrder - b.sortOrder);
  const inactive = items.filter((item) => item.status !== 'READY');

  function card(media: Media, index = -1) {
    const current = media.status === 'READY';
    const preview = media.status === 'READY' || media.status === 'ARCHIVED';
    return (
      <li
        key={media.mediaId}
        className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50"
      >
        {preview ? (
          <Image
            unoptimized
            src={`${path}/${media.mediaId}/content`}
            alt={media.altText || t('imagePreview')}
            width={640}
            height={360}
            className="aspect-video w-full object-cover"
          />
        ) : (
          <div className="flex aspect-video items-center justify-center bg-slate-200 text-sm text-slate-700">
            {t('previewUnavailable')}
          </div>
        )}
        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <strong className="text-sm text-slate-950">
              {media.role === 'HERO' ? t('hero') : t('galleryItem')}
            </strong>
            <span className="rounded bg-slate-200 px-2 py-1 text-xs font-semibold text-slate-800">
              {t(`status${media.status}`)}
            </span>
          </div>
          {media.caption ? (
            <p className="break-words text-sm text-slate-700">
              {media.caption}
            </p>
          ) : null}
          {current && !archived ? (
            <form
              onSubmit={(event) => saveMetadata(event, media.mediaId)}
              className="space-y-2"
            >
              <label className="block text-xs font-semibold text-slate-700">
                {t('altText')}
                <input
                  name="altText"
                  defaultValue={media.altText ?? ''}
                  maxLength={240}
                  disabled={busy}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
              </label>
              <label className="block text-xs font-semibold text-slate-700">
                {t('caption')}
                <input
                  name="caption"
                  defaultValue={media.caption ?? ''}
                  maxLength={500}
                  disabled={busy}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
                />
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-800 disabled:opacity-60"
                >
                  {t('saveMetadata')}
                </button>
                <button
                  type="button"
                  ref={(element) => {
                    if (element)
                      archiveTriggers.current.set(media.mediaId, element);
                    else archiveTriggers.current.delete(media.mediaId);
                  }}
                  disabled={busy}
                  onClick={() => setConfirmArchive(media.mediaId)}
                  className="rounded border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-800 disabled:opacity-60"
                >
                  {t('archive')}
                </button>
              </div>
            </form>
          ) : null}
          {current && media.role === 'GALLERY' && !archived ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || nextPage !== null || index === 0}
                onClick={() => moveGallery(media.mediaId, -1, gallery)}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
              >
                {t('moveEarlier')}
              </button>
              <button
                type="button"
                disabled={
                  busy || nextPage !== null || index === gallery.length - 1
                }
                onClick={() => moveGallery(media.mediaId, 1, gallery)}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
              >
                {t('moveLater')}
              </button>
            </div>
          ) : null}
          {confirmArchive === media.mediaId ? (
            <div
              role="group"
              aria-label={t('confirmArchive')}
              onKeyDown={(event) => {
                if (event.key === 'Escape') {
                  event.preventDefault();
                  event.stopPropagation();
                  cancelArchive(media.mediaId);
                }
              }}
              className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900"
            >
              <p>{t('archiveExplanation', { name: destinationName })}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => archive(media.mediaId)}
                  className="rounded bg-red-700 px-3 py-1.5 font-semibold text-white disabled:opacity-60"
                >
                  {t('confirmArchive')}
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => cancelArchive(media.mediaId)}
                  className="rounded border border-slate-300 px-3 py-1.5 font-semibold"
                >
                  {t('cancel')}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </li>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2
        ref={headingRef}
        tabIndex={-1}
        className="text-lg font-bold text-slate-950"
      >
        {t('title')}
      </h2>
      <p className="mt-1 text-sm text-slate-600">{t('description')}</p>
      <p className="mt-2 text-xs text-slate-600">
        {t('videoDeferred')} {t('paymentDeferred')}
      </p>
      {archived ? (
        <p className="mt-3 rounded bg-amber-50 p-3 text-sm text-amber-900">
          {t('archivedDestination')}
        </p>
      ) : null}
      {error ? (
        <p
          role="alert"
          className="mt-4 rounded bg-red-50 p-3 text-sm text-red-800"
        >
          {error}{' '}
          <button
            type="button"
            onClick={() => void loadPage(1)}
            className="underline"
          >
            {t('retry')}
          </button>
        </p>
      ) : null}
      {notice ? (
        <p
          aria-live="polite"
          className="mt-4 rounded bg-emerald-50 p-3 text-sm text-emerald-900"
        >
          {notice}
        </p>
      ) : null}
      {loading ? <p className="mt-4 text-sm">{t('loading')}</p> : null}

      {!loading ? (
        <div className="mt-5 space-y-6">
          <div>
            <h3 className="font-semibold text-slate-950">{t('hero')}</h3>
            <p className="mb-3 text-sm text-slate-600">{t('heroHelp')}</p>
            {hero ? (
              <ul className="grid gap-4 sm:grid-cols-2">{card(hero)}</ul>
            ) : (
              <p className="text-sm text-slate-600">
                {nextPage ? t('loadMoreForCurrent') : t('noHero')}
              </p>
            )}
          </div>
          <div>
            <h3 className="font-semibold text-slate-950">{t('gallery')}</h3>
            {gallery.length ? (
              <ul className="mt-3 grid gap-4 sm:grid-cols-2">
                {gallery.map((media, index) => card(media, index))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-600">{t('noGallery')}</p>
            )}
            {nextPage ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  void loadPage(nextPage, true)
                    .catch(() => setError(t('loadError')))
                    .finally(() => setBusy(false));
                }}
                className="mt-3 rounded border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-60"
              >
                {t('loadMore')}
              </button>
            ) : null}
          </div>
          {inactive.length ? (
            <div>
              <h3 className="font-semibold text-slate-950">{t('history')}</h3>
              <ul className="mt-3 grid gap-4 sm:grid-cols-2">
                {inactive.map((media) => card(media))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {!archived ? (
        <form
          onSubmit={(event) => void upload(event)}
          className="mt-6 space-y-3 border-t border-slate-200 pt-5"
        >
          <h3 className="font-semibold text-slate-950">{t('uploadTitle')}</h3>
          <label className="block text-sm font-semibold text-slate-800">
            {t('imageRole')}
            <select
              value={role}
              onChange={(event) =>
                setRole(event.target.value as 'HERO' | 'GALLERY')
              }
              disabled={busy}
              className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
            >
              <option value="GALLERY">{t('gallery')}</option>
              <option value="HERO">{t('hero')}</option>
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-800">
            {t('imageFile')}
            <input
              type="file"
              name="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              disabled={busy}
              className="mt-1 block w-full text-sm"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block text-sm font-semibold text-slate-800">
              {t('altText')}
              <input
                name="altText"
                maxLength={240}
                disabled={busy}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="block text-sm font-semibold text-slate-800">
              {t('caption')}
              <input
                name="caption"
                maxLength={500}
                disabled={busy}
                className="mt-1 w-full rounded border border-slate-300 px-3 py-2"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={busy}
            className="rounded bg-emerald-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy
              ? t('uploading')
              : role === 'HERO'
                ? hero
                  ? t('replaceHero')
                  : t('setHero')
                : t('uploadGallery')}
          </button>
          <p className="text-xs text-slate-600">{t('imageRules')}</p>
        </form>
      ) : null}
    </section>
  );
}
