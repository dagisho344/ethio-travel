import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  authenticatedBackendJson,
  clearAuthCookies,
  jsonError,
  setAuthCookies,
  validateSameOrigin,
} from '../../../lib/auth/session';
import type { FavoriteTargetType } from '../../../lib/types';

const allowedTargetTypes = new Set<FavoriteTargetType>([
  'BUSINESS',
  'SERVICE',
  'DESTINATION',
  'ATTRACTION',
]);

function favoriteQuery(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const query = new URLSearchParams();
  const page = params.get('page');
  const limit = params.get('limit');
  const targetType = params.get('targetType') as FavoriteTargetType | null;
  if (page) query.set('page', page);
  if (limit) query.set('limit', limit);
  if (targetType && allowedTargetTypes.has(targetType)) {
    query.set('targetType', targetType);
  }
  return query.toString();
}

export async function GET(request: NextRequest) {
  try {
    const query = favoriteQuery(request);
    const result = await authenticatedBackendJson(
      `/users/me/favorites${query ? `?${query}` : ''}`,
    );
    const response = NextResponse.json(result.data);
    if (result.auth) setAuthCookies(response, result.auth);
    return response;
  } catch (error) {
    const response = jsonError(error);
    if (response.status === 401) clearAuthCookies(response);
    return response;
  }
}

export async function POST(request: NextRequest) {
  try {
    validateSameOrigin(request);
    const result = await authenticatedBackendJson('/favorites', {
      method: 'POST',
      body: JSON.stringify(await request.json()),
    });
    const response = NextResponse.json(result.data, { status: 201 });
    if (result.auth) setAuthCookies(response, result.auth);
    return response;
  } catch (error) {
    const response = jsonError(error);
    if (response.status === 401) clearAuthCookies(response);
    return response;
  }
}
