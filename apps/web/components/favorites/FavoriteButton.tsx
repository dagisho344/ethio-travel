'use client';

import { useMemo, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Heart } from 'lucide-react';
import type {
  Favorite,
  FavoriteTargetType,
  PaginatedResponse,
} from '../../lib/types';

type FavoriteButtonProps = {
  targetType: FavoriteTargetType;
  targetId: string;
  targetName: string;
  initialFavoriteId?: string;
  className?: string;
};

class FavoriteRouteError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

async function readError(response: Response): Promise<string> {
  const data = (await response.json().catch(() => null)) as {
    message?: string | string[];
  } | null;
  if (Array.isArray(data?.message)) return data.message.join(' ');
  return data?.message ?? 'Favorite request failed.';
}

async function favoriteRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!response.ok) {
    throw new FavoriteRouteError(await readError(response), response.status);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

function safeReturnTo(
  pathname: string,
  params: { toString(): string },
): string {
  const query = params.toString();
  const value = query ? `${pathname}?${query}` : pathname;
  return value.startsWith('/') && !value.startsWith('//') ? value : '/explore';
}

export function FavoriteButton({
  targetType,
  targetId,
  targetName,
  initialFavoriteId,
  className = '',
}: FavoriteButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [favoriteId, setFavoriteId] = useState(initialFavoriteId ?? null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const favorited = Boolean(favoriteId);
  const label = favorited
    ? `Remove ${targetName} from favorites`
    : `Save ${targetName} to favorites`;

  const loginUrl = useMemo(() => {
    const params = new URLSearchParams({
      returnTo: safeReturnTo(pathname, searchParams),
    });
    return `/login?${params.toString()}`;
  }, [pathname, searchParams]);

  async function reconcileExistingFavorite() {
    const page = await favoriteRequest<PaginatedResponse<Favorite>>(
      `/api/favorites?targetType=${targetType}&limit=100`,
    );
    const match = page.data.find(
      (favorite) =>
        favorite.target.type === targetType && favorite.target.id === targetId,
    );
    if (match) setFavoriteId(match.id);
  }

  async function onClick() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      if (favoriteId) {
        await favoriteRequest<void>(`/api/favorites/${favoriteId}`, {
          method: 'DELETE',
        });
        setFavoriteId(null);
        router.refresh();
        return;
      }

      const favorite = await favoriteRequest<Favorite>('/api/favorites', {
        method: 'POST',
        body: JSON.stringify({ targetType, targetId }),
      });
      setFavoriteId(favorite.id);
      router.refresh();
    } catch (err) {
      if (err instanceof FavoriteRouteError && err.status === 401) {
        router.push(loginUrl);
        return;
      }
      if (err instanceof FavoriteRouteError && err.status === 409) {
        await reconcileExistingFavorite().catch(() => undefined);
        return;
      }
      if (
        err instanceof FavoriteRouteError &&
        err.status === 404 &&
        favoriteId
      ) {
        setFavoriteId(null);
        return;
      }
      setError('We could not update your favorite right now.');
    } finally {
      setPending(false);
    }
  }

  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => void onClick()}
        disabled={pending}
        aria-label={label}
        aria-pressed={favorited}
        title={favorited ? 'Saved' : 'Save'}
        className={`inline-flex h-10 w-10 items-center justify-center rounded-full border bg-white/95 text-slate-700 shadow-sm transition hover:border-highland hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${favorited ? 'border-highland text-highland' : 'border-slate-200'}`}
      >
        <Heart
          className={`h-5 w-5 ${favorited ? 'fill-current' : ''}`}
          aria-hidden="true"
        />
      </button>
      {error ? (
        <p className="mt-2 max-w-44 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-900">
          {error}
        </p>
      ) : null}
    </div>
  );
}
