import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  authenticatedBackendJson,
  clearAuthCookies,
  jsonError,
  setAuthCookies,
} from '../../../lib/auth/session';

function notificationQuery(request: NextRequest): string {
  const query = new URLSearchParams();
  for (const key of ['page', 'limit', 'unreadOnly', 'type']) {
    const value = request.nextUrl.searchParams.get(key);
    if (value) query.set(key, value);
  }
  const value = query.toString();
  return value ? `?${value}` : '';
}

export async function GET(request: NextRequest) {
  try {
    const result = await authenticatedBackendJson(
      `/users/me/notifications${notificationQuery(request)}`,
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
