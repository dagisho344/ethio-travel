'use client';

import { ChevronLeft, ChevronRight, ImageIcon, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { publicMediaUrl } from '../../lib/public-media';
import type { PublicDestinationMedia } from '../../lib/types';

const publicImagePath =
  /^\/api\/v1\/media\/public\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const imageMimeTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

// The API owns publication, location, status and visibility checks. This is
// only a defensive check of the already-public image reference's shape.
export function isPublicDestinationImage(
  media: PublicDestinationMedia | null | undefined,
  role: 'HERO' | 'GALLERY',
): media is PublicDestinationMedia {
  return Boolean(
    media &&
    media.role === role &&
    media.mediaType === 'IMAGE' &&
    imageMimeTypes.has(media.mimeType) &&
    publicImagePath.test(media.accessPath),
  );
}

function ImageFallback({ compact = false }: { compact?: boolean }) {
  const t = useTranslations('destinations');
  return (
    <div className="flex h-full min-h-36 w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-emerald-50 via-sky-50 to-amber-50 text-highland">
      <ImageIcon className="h-7 w-7" aria-hidden="true" />
      <span className={compact ? 'sr-only' : 'text-sm text-slate-600'}>
        {t('noCoverImage')}
      </span>
    </div>
  );
}

export function PublicDestinationThumbnail({
  destinationName,
  hero,
}: {
  destinationName: string;
  hero: PublicDestinationMedia | null | undefined;
}) {
  const t = useTranslations('destinations');
  const [failed, setFailed] = useState(false);

  return (
    <div className="h-36 overflow-hidden bg-slate-100">
      {isPublicDestinationImage(hero, 'HERO') && !failed ? (
        <img
          src={publicMediaUrl(hero)}
          alt={hero.altText || t('coverImageAlt', { name: destinationName })}
          width={720}
          height={450}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        <ImageFallback compact />
      )}
    </div>
  );
}

export function PublicDestinationHero({
  destinationName,
  hero,
}: {
  destinationName: string;
  hero: PublicDestinationMedia | null | undefined;
}) {
  const t = useTranslations('destinations');
  const [failed, setFailed] = useState(false);

  return (
    <figure className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
      {isPublicDestinationImage(hero, 'HERO') && !failed ? (
        <>
          <img
            src={publicMediaUrl(hero)}
            alt={hero.altText || t('coverImageAlt', { name: destinationName })}
            width={1200}
            height={675}
            decoding="async"
            className="aspect-[16/9] w-full object-cover"
            onError={() => setFailed(true)}
          />
          {hero.caption ? (
            <figcaption className="break-words bg-white px-4 py-2 text-sm text-slate-600">
              {hero.caption}
            </figcaption>
          ) : null}
        </>
      ) : (
        <div className="aspect-[16/9]">
          <ImageFallback />
        </div>
      )}
    </figure>
  );
}

export function PublicDestinationGallery({
  destinationName,
  media,
}: {
  destinationName: string;
  media: PublicDestinationMedia[] | undefined;
}) {
  const t = useTranslations('destinations');
  const [failedIds, setFailedIds] = useState<Set<string>>(() => new Set());
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  const gallery = (media ?? [])
    .filter((item) => isPublicDestinationImage(item, 'GALLERY'))
    .slice(0, 12)
    .filter((item) => !failedIds.has(item.id));
  const selected = selectedIndex === null ? null : gallery[selectedIndex];

  const closeViewer = useCallback(() => {
    setSelectedIndex(null);
    window.requestAnimationFrame(() => openerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (selectedIndex === null || gallery.length === 0) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeViewer();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        setSelectedIndex((index) =>
          index === null ? null : (index + 1) % gallery.length,
        );
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setSelectedIndex((index) =>
          index === null ? null : (index - 1 + gallery.length) % gallery.length,
        );
      } else if (event.key === 'Tab') {
        const buttons = dialogRef.current?.querySelectorAll('button');
        if (!buttons?.length) return;
        const first = buttons[0];
        const last = buttons[buttons.length - 1];
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
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [closeViewer, gallery.length, selectedIndex]);

  if (!gallery.length) return null;

  return (
    <section className="mt-8" aria-labelledby="destination-gallery-heading">
      <h2
        id="destination-gallery-heading"
        className="text-2xl font-bold text-slate-950"
      >
        {t('gallery')}
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {gallery.map((item, index) => (
          <figure
            key={item.id}
            className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
          >
            <button
              type="button"
              onClick={(event) => {
                openerRef.current = event.currentTarget;
                setSelectedIndex(index);
              }}
              className="block w-full bg-slate-100 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-highland"
              aria-label={t('viewGalleryImage', { number: index + 1 })}
            >
              <img
                src={publicMediaUrl(item)}
                alt={
                  item.altText ||
                  t('galleryImageAlt', {
                    name: destinationName,
                    number: index + 1,
                  })
                }
                width={640}
                height={480}
                loading="lazy"
                decoding="async"
                className="aspect-[4/3] w-full object-cover"
                onError={() => {
                  setFailedIds((current) => new Set(current).add(item.id));
                  if (selected?.id === item.id) closeViewer();
                }}
              />
            </button>
            {item.caption ? (
              <figcaption className="break-words px-3 py-2 text-sm text-slate-600">
                {item.caption}
              </figcaption>
            ) : null}
          </figure>
        ))}
      </div>
      {selected ? (
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={t('imageViewer', { name: destinationName })}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-3 sm:p-6"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeViewer();
          }}
        >
          <div className="relative flex max-h-full min-w-0 max-w-5xl flex-col items-center gap-3">
            <button
              ref={closeRef}
              type="button"
              onClick={closeViewer}
              className="absolute right-2 top-2 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-900 shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              aria-label={t('closeImageViewer')}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <img
              src={publicMediaUrl(selected)}
              alt={
                selected.altText ||
                t('galleryImageAlt', {
                  name: destinationName,
                  number: selectedIndex! + 1,
                })
              }
              width={1200}
              height={900}
              className="max-h-[75vh] max-w-full rounded-lg object-contain"
              onError={() => {
                setFailedIds((current) => new Set(current).add(selected.id));
                closeViewer();
              }}
            />
            {selected.caption ? (
              <p className="max-w-full break-words rounded-md bg-white px-3 py-2 text-sm text-slate-700">
                {selected.caption}
              </p>
            ) : null}
            <div className="flex items-center gap-3 text-white">
              <button
                type="button"
                onClick={() =>
                  setSelectedIndex((index) =>
                    index === null
                      ? null
                      : (index - 1 + gallery.length) % gallery.length,
                  )
                }
                className="inline-flex min-h-11 items-center gap-1 rounded-md border border-white/60 px-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label={t('previousImage')}
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                <span className="hidden sm:inline">{t('previousImage')}</span>
              </button>
              <span aria-live="polite">
                {t('imagePosition', {
                  current: selectedIndex! + 1,
                  total: gallery.length,
                })}
              </span>
              <button
                type="button"
                onClick={() =>
                  setSelectedIndex((index) =>
                    index === null ? null : (index + 1) % gallery.length,
                  )
                }
                className="inline-flex min-h-11 items-center gap-1 rounded-md border border-white/60 px-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                aria-label={t('nextImage')}
              >
                <span className="hidden sm:inline">{t('nextImage')}</span>
                <ChevronRight className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
