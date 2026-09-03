import type { Favorite, FavoriteTargetType } from './types';

export type FavoriteLookup = Record<string, string>;

export function favoriteLookupKey(
  targetType: FavoriteTargetType,
  targetId: string,
): string {
  return `${targetType}:${targetId}`;
}

export function buildFavoriteLookup(favorites: Favorite[]): FavoriteLookup {
  return Object.fromEntries(
    favorites.map((favorite) => [
      favoriteLookupKey(favorite.target.type, favorite.target.id),
      favorite.id,
    ]),
  );
}
