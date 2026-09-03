'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Heart, MapPin, Trash2 } from 'lucide-react';
import { formatPricing } from '../../lib/format';
import type {
  Favorite,
  FavoriteTarget,
  FavoriteTargetType,
  PaginatedResponse,
} from '../../lib/types';

const targetOptions: Array<{ value: FavoriteTargetType | ''; label: string }> =
  [
    { value: '', label: 'All saved places' },
    { value: 'DESTINATION', label: 'Destinations' },
    { value: 'ATTRACTION', label: 'Attractions' },
    { value: 'BUSINESS', label: 'Businesses' },
    { value: 'SERVICE', label: 'Services' },
  ];

function targetLabel(type: FavoriteTargetType) {
  return targetOptions.find((option) => option.value === type)?.label ?? type;
}

function targetPath(target: FavoriteTarget) {
  if (target.type === 'DESTINATION') {
    return `/explore?types=destination&regionSlug=${encodeURIComponent(target.region?.slug ?? '')}&citySlug=${encodeURIComponent(target.city?.slug ?? '')}&destinationSlug=${encodeURIComponent(target.slug)}`;
  }
  if (target.type === 'ATTRACTION') {
    return `/explore?types=attraction&regionSlug=${encodeURIComponent(target.region?.slug ?? '')}&citySlug=${encodeURIComponent(target.city?.slug ?? '')}&destinationSlug=${encodeURIComponent(target.destination?.slug ?? '')}&q=${encodeURIComponent(target.name)}`;
  }
  if (target.type === 'BUSINESS') {
    return `/explore?types=business&regionSlug=${encodeURIComponent(target.region?.slug ?? '')}&citySlug=${encodeURIComponent(target.city?.slug ?? '')}&q=${encodeURIComponent(target.name)}`;
  }
  return `/explore?types=service&regionSlug=${encodeURIComponent(target.region?.slug ?? '')}&citySlug=${encodeURIComponent(target.city?.slug ?? '')}&q=${encodeURIComponent(target.name)}`;
}

function locationLine(target: FavoriteTarget) {
  if (target.type === 'SERVICE') {
    return [target.business?.name, target.city?.name, target.region?.name]
      .filter(Boolean)
      .join(', ');
  }
  if (target.type === 'ATTRACTION') {
    return [target.destination?.name, target.city?.name, target.region?.name]
      .filter(Boolean)
      .join(', ');
  }
  return [target.city?.name, target.region?.name].filter(Boolean).join(', ');
}

function description(target: FavoriteTarget) {
  if (target.type === 'SERVICE') return target.shortDescription;
  if (target.type === 'DESTINATION') return target.shortDescription;
  return target.description;
}

function FavoriteCard({
  favorite,
  onRemove,
  removing,
}: {
  favorite: Favorite;
  onRemove: (favorite: Favorite) => void;
  removing: boolean;
}) {
  const target = favorite.target;
  const location = locationLine(target);

  return (
    <article className="flex h-full flex-col rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <span className="inline-flex rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
            {targetLabel(target.type)}
          </span>
          <h2 className="mt-3 text-lg font-bold text-slate-950">
            {target.name}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => void onRemove(favorite)}
          disabled={removing}
          aria-label={`Remove ${target.name} from favorites`}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>

      {location ? (
        <p className="mt-3 flex items-center gap-1.5 text-sm text-slate-500">
          <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{location}</span>
        </p>
      ) : null}

      {target.type === 'SERVICE' ? (
        <p className="mt-3 text-sm font-semibold text-slate-950">
          {formatPricing(target.pricingModel, target.price, target.currency)}
        </p>
      ) : null}

      {description(target) ? (
        <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
          {description(target)}
        </p>
      ) : null}

      <Link
        href={targetPath(target)}
        className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-highland hover:text-highland/80 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
      >
        View details
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </article>
  );
}

export function FavoritesClient() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [page, setPage] = useState<PaginatedResponse<Favorite> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const targetType = searchParams.get(
    'targetType',
  ) as FavoriteTargetType | null;
  const currentPage = searchParams.get('page') ?? '1';

  const query = useMemo(() => {
    const params = new URLSearchParams({ page: currentPage, limit: '9' });
    if (targetType) params.set('targetType', targetType);
    return params.toString();
  }, [currentPage, targetType]);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/favorites?${query}`, {
          cache: 'no-store',
        });
        if (response.status === 401) {
          router.replace(
            `/login?returnTo=${encodeURIComponent(`${pathname}?${query}`)}`,
          );
          return;
        }
        if (!response.ok) throw new Error('Request failed');
        setPage((await response.json()) as PaginatedResponse<Favorite>);
      } catch {
        setPage(null);
        setError('We could not load your favorites right now.');
      } finally {
        setLoading(false);
      }
    };
    void run();
  }, [pathname, query, router]);

  function update(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value) params.set(key, value);
      else params.delete(key);
    });
    const url = params.toString() ? `${pathname}?${params}` : pathname;
    router.push(url);
  }

  async function removeFavorite(favorite: Favorite) {
    setRemovingId(favorite.id);
    setError(null);
    try {
      const response = await fetch(`/api/favorites/${favorite.id}`, {
        method: 'DELETE',
      });
      if (response.status === 401) {
        router.replace(
          `/login?returnTo=${encodeURIComponent(`${pathname}?${query}`)}`,
        );
        return;
      }
      if (!response.ok && response.status !== 404)
        throw new Error('Request failed');
      setPage((current) =>
        current
          ? {
              ...current,
              data: current.data.filter((item) => item.id !== favorite.id),
              meta: {
                ...current.meta,
                total: Math.max(current.meta.total - 1, 0),
              },
            }
          : current,
      );
      router.refresh();
    } catch {
      setError('We could not remove that favorite right now.');
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end sm:justify-between">
        <label className="text-sm font-semibold text-slate-700">
          Filter saved items
          <select
            value={targetType ?? ''}
            onChange={(event) =>
              update({ targetType: event.target.value || null, page: null })
            }
            className="mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none focus:border-highland focus:ring-2 focus:ring-highland/20 sm:w-64"
          >
            {targetOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <div className="mb-5 rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Loading favorites...
        </div>
      ) : page?.data.length ? (
        <>
          <div className="mb-4 flex items-center justify-between gap-4 text-sm text-slate-600">
            <p>
              {page.meta.total} saved item{page.meta.total === 1 ? '' : 's'}
            </p>
            <p>
              Page {page.meta.page} of {Math.max(page.meta.totalPages, 1)}
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {page.data.map((favorite) => (
              <FavoriteCard
                key={favorite.id}
                favorite={favorite}
                onRemove={(favorite) => void removeFavorite(favorite)}
                removing={removingId === favorite.id}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-highland">
            <Heart className="h-6 w-6" aria-hidden="true" />
          </div>
          <h2 className="mt-4 text-base font-semibold text-slate-950">
            No favorites yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
            Save destinations, attractions, businesses and services you want to
            revisit.
          </p>
          <Link
            href="/explore"
            className="mt-5 inline-flex rounded-md bg-highland px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
          >
            Start exploring
          </Link>
        </div>
      )}

      {page && page.meta.totalPages > 1 ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            disabled={page.meta.page <= 1}
            onClick={() => update({ page: String(page.meta.page - 1) })}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page.meta.page >= page.meta.totalPages}
            onClick={() => update({ page: String(page.meta.page + 1) })}
            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
}
