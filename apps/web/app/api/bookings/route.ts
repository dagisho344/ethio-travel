import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  authenticatedBackendJson,
  clearAuthCookies,
  jsonError,
  setAuthCookies,
  validateSameOrigin,
} from '../../../lib/auth/session';
import type { BookingStatus } from '../../../lib/types';

const allowedStatuses = new Set<BookingStatus>([
  'PENDING',
  'CONFIRMED',
  'REJECTED',
  'CANCELLED_BY_TRAVELER',
  'CANCELLED_BY_BUSINESS',
  'COMPLETED',
  'NO_SHOW',
]);

function bookingQuery(request: NextRequest) {
  const source = request.nextUrl.searchParams;
  const query = new URLSearchParams();
  for (const key of ['page', 'limit']) {
    const value = source.get(key);
    if (value) query.set(key, value);
  }
  const status = source.get('status') as BookingStatus | null;
  if (status && allowedStatuses.has(status)) query.set('status', status);
  return query.toString();
}

export async function GET(request: NextRequest) {
  try {
    const query = bookingQuery(request);
    const result = await authenticatedBackendJson(
      `/users/me/bookings${query ? `?${query}` : ''}`,
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
    const result = await authenticatedBackendJson('/bookings', {
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
