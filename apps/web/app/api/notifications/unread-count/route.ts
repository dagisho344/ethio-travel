import { NextResponse } from 'next/server';
import {
  authenticatedBackendJson,
  clearAuthCookies,
  jsonError,
  setAuthCookies,
} from '../../../../lib/auth/session';

export async function GET() {
  try {
    const result = await authenticatedBackendJson(
      '/users/me/notifications/unread-count',
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
