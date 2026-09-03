import { backendJson, currentTokens } from './auth/session';
import { buildFavoriteLookup, type FavoriteLookup } from './favorite-utils';
import type { Favorite, FavoriteTargetType, PaginatedResponse } from './types';

export { favoriteLookupKey, type FavoriteLookup } from './favorite-utils';

export async function getInitialFavoriteLookup(
  targetType?: FavoriteTargetType,
): Promise<FavoriteLookup> {
  const { accessToken } = await currentTokens();
  if (!accessToken) return {};

  const query = new URLSearchParams({ limit: '100' });
  if (targetType) query.set('targetType', targetType);

  try {
    const response = await backendJson<PaginatedResponse<Favorite>>(
      `/users/me/favorites?${query.toString()}`,
      { headers: { authorization: `Bearer ${accessToken}` } },
    );
    return buildFavoriteLookup(response.data);
  } catch {
    return {};
  }
}
