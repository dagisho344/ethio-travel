import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  authenticatedBackendJson,
  clearAuthCookies,
  jsonError,
  setAuthCookies,
} from '../../../../../lib/auth/session';
import type { BookingStatus } from '../../../../../lib/types';

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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    const query = bookingQuery(request);
    const result = await authenticatedBackendJson(
      `/businesses/${businessId}/bookings${query ? `?${query}` : ''}`,
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
