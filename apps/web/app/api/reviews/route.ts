import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  authenticatedBackendJson,
  clearAuthCookies,
  jsonError,
  setAuthCookies,
  validateSameOrigin,
} from '../../../lib/auth/session';
import { backendJson } from '../../../lib/auth/session';
import type { ReviewStatus, ReviewTargetType } from '../../../lib/types';

const allowedTargetTypes = new Set<ReviewTargetType>([
  'BUSINESS',
  'SERVICE',
  'DESTINATION',
  'ATTRACTION',
]);
const allowedStatuses = new Set<ReviewStatus>([
  'PENDING',
  'PUBLISHED',
  'HIDDEN',
  'REJECTED',
]);
const allowedSorts = new Set(['newest', 'oldest', 'highest', 'lowest']);

function copyReviewQuery(request: NextRequest, own: boolean) {
  const source = request.nextUrl.searchParams;
  const query = new URLSearchParams();
  for (const key of ['page', 'limit', 'targetId', 'rating']) {
    const value = source.get(key);
    if (value) query.set(key, value);
  }
  const targetType = source.get('targetType') as ReviewTargetType | null;
  if (targetType && allowedTargetTypes.has(targetType)) {
    query.set('targetType', targetType);
  }
  const status = source.get('status') as ReviewStatus | null;
  if (own && status && allowedStatuses.has(status)) query.set('status', status);
  const sort = source.get('sort');
  if (!own && sort && allowedSorts.has(sort)) query.set('sort', sort);
  return query.toString();
}

export async function GET(request: NextRequest) {
  try {
    const own = request.nextUrl.searchParams.get('mine') === 'true';
    const query = copyReviewQuery(request, own);
    if (own) {
      const result = await authenticatedBackendJson(
        `/users/me/reviews${query ? `?${query}` : ''}`,
      );
      const response = NextResponse.json(result.data);
      if (result.auth) setAuthCookies(response, result.auth);
      return response;
    }
    return NextResponse.json(
      await backendJson(`/reviews${query ? `?${query}` : ''}`),
    );
  } catch (error) {
    const response = jsonError(error);
    if (response.status === 401) clearAuthCookies(response);
    return response;
  }
}

export async function POST(request: NextRequest) {
  try {
    validateSameOrigin(request);
    const result = await authenticatedBackendJson('/reviews', {
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
