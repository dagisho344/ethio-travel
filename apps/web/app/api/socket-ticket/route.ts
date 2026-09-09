import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  authenticatedBackendJson,
  clearAuthCookies,
  jsonError,
  setAuthCookies,
  validateSameOrigin,
} from '../../../lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    validateSameOrigin(request);
    const result = await authenticatedBackendJson('/auth/socket-ticket', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const response = NextResponse.json(result.data);
    if (result.auth) setAuthCookies(response, result.auth);
    return response;
  } catch (error) {
    const response = jsonError(error);
    if (response.status === 401) clearAuthCookies(response);
    return response;
  }
}
