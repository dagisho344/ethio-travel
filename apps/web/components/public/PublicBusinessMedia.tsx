'use client';

import { X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { publicMediaUrl } from '../../lib/public-media';
import type { PublicMedia } from '../../lib/types';

type MediaProps = {
  businessName: string;
  media: PublicMedia | null | undefined;
};

function fallbackAlt(
  businessName: string,
  kind: 'cover' | 'logo' | 'gallery',
  index?: number,
  labels?: { cover: string; gallery: string; logo: string },
): string {
  if (kind === 'gallery')
    return `${labels?.gallery ?? 'Gallery image'} ${String((index ?? 0) + 1)} ${businessName}`;
  return `${kind === 'cover' ? (labels?.cover ?? 'Cover image') : (labels?.logo ?? 'Logo')} ${businessName}`;
}

export function PublicBusinessLogo({ businessName, media }: MediaProps) {
  const t = useTranslations('marketplace');
  const [failed, setFailed] = useState(false);
  if (!media || failed) return null;

  return (
    <img
      src={publicMediaUrl(media)}
      alt={
        media.altText ||
        fallbackAlt(businessName, 'logo', undefined, {
          cover: t('coverImage'),
          gallery: t('galleryImage'),
          logo: t('logo'),
        })
      }
      className="h-14 w-14 rounded-xl border border-slate-200 bg-white object-contain p-1 shadow-sm sm:h-16 sm:w-16"
      onError={() => setFailed(true)}
    />
  );
}

export function PublicBusinessCover({ businessName, media }: MediaProps) {
  const t = useTranslations('marketplace');
  const [failed, setFailed] = useState(false);
  if (!media || failed) return null;

  return (
    <figure className="overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm">
      <img
        src={publicMediaUrl(media)}
        alt={
          media.altText ||
          fallbackAlt(businessName, 'cover', undefined, {
            cover: t('coverImage'),
            gallery: t('galleryImage'),
            logo: t('logo'),
          })
        }
        className="aspect-[16/7] w-full object-cover sm:aspect-[21/8]"
        onError={() => setFailed(true)}
      />
      {media.caption ? (
        <figcaption className="border-t border-slate-100 bg-white px-4 py-2 text-sm text-slate-600">
          {media.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}

export function PublicBusinessCardImage({
  businessName,
  hero,
  logo,
}: {
  businessName: string;
  hero: PublicMedia | null | undefined;
  logo: PublicMedia | null | undefined;
}) {
  const t = useTranslations('marketplace');
  const [heroFailed, setHeroFailed] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <div className="relative h-32 overflow-hidden bg-gradient-to-br from-emerald-50 via-sky-50 to-amber-50">
      {hero && !heroFailed ? (
        <img
          src={publicMediaUrl(hero)}
          alt={
            hero.altText ||
            fallbackAlt(businessName, 'cover', undefined, {
              cover: t('coverImage'),
              gallery: t('galleryImage'),
              logo: t('logo'),
            })
          }
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setHeroFailed(true)}
        />
      ) : (
        <span className="sr-only">{t('noCover')}</span>
      )}
      {logo && !logoFailed ? (
        <img
          src={publicMediaUrl(logo)}
          alt={
            logo.altText ||
            fallbackAlt(businessName, 'logo', undefined, {
              cover: t('coverImage'),
              gallery: t('galleryImage'),
              logo: t('logo'),
            })
          }
          loading="lazy"
          className="absolute bottom-3 left-3 h-12 w-12 rounded-lg border border-white bg-white object-contain p-1 shadow-md"
          onError={() => setLogoFailed(true)}
        />
      ) : null}
    </div>
  );
}

export function PublicBusinessGallery({
  businessName,
  media,
}: {
  businessName: string;
  media: PublicMedia[] | undefined;
}) {
  const t = useTranslations('marketplace');
  const [failedIds, setFailedIds] = useState<Set<string>>(() => new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const gallery = (media ?? []).filter((item) => !failedIds.has(item.id));
  const selected = gallery.find((item) => item.id === selectedId) ?? null;

  useEffect(() => {
    if (!selected) return;
    closeButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSelectedId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selected]);

  if (!gallery.length) return null;

  return (
    <section className="mt-8" aria-labelledby="business-gallery-heading">
      <h2
        id="business-gallery-heading"
        className="text-2xl font-bold text-slate-950"
      >
        {t('gallery')}
      </h2>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {gallery.map((item, index) => (
          <figure
            key={item.id}
            className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm"
          >
            <button
              type="button"
              onClick={() => setSelectedId(item.id)}
              className="block w-full bg-slate-100 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-inset"
              aria-label={`${t('viewImage')} ${item.altText || fallbackAlt(businessName, 'gallery', index, { cover: t('coverImage'), gallery: t('galleryImage'), logo: t('logo') })}`}
            >
              <img
                src={publicMediaUrl(item)}
                alt={
                  item.altText ||
                  fallbackAlt(businessName, 'gallery', index, {
                    cover: t('coverImage'),
                    gallery: t('galleryImage'),
                    logo: t('logo'),
                  })
                }
                loading="lazy"
                className="aspect-[4/3] w-full object-cover transition duration-200 hover:scale-[1.02]"
                onError={() =>
                  setFailedIds((current) => new Set(current).add(item.id))
                }
              />
            </button>
            {item.caption ? (
              <figcaption className="px-3 py-2 text-sm text-slate-600">
                {item.caption}
              </figcaption>
            ) : null}
          </figure>
        ))}
      </div>
      {selected ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${t('expandedImage')} ${businessName}`}
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4"
          onMouseDown={() => setSelectedId(null)}
        >
          <div
            className="relative max-h-full max-w-5xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => setSelectedId(null)}
              className="absolute right-2 top-2 z-10 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-slate-900 shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              aria-label={t('closeImageViewer')}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
            <img
              src={publicMediaUrl(selected)}
              alt={
                selected.altText ||
                fallbackAlt(businessName, 'gallery', undefined, {
                  cover: t('coverImage'),
                  gallery: t('galleryImage'),
                  logo: t('logo'),
                })
              }
              className="max-h-[80vh] max-w-full rounded-lg object-contain"
            />
            {selected.caption ? (
              <p className="mt-3 rounded-md bg-white px-3 py-2 text-sm text-slate-700">
                {selected.caption}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
