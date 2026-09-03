import { NextRequest, NextResponse } from 'next/server';
import {
  clearAuthCookies,
  currentTokens,
  jsonError,
  logoutWithBackend,
  validateSameOrigin,
} from '../../../../lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    validateSameOrigin(request);
    const { accessToken } = await currentTokens();
    if (accessToken) {
      try {
        await logoutWithBackend(accessToken);
      } catch {
        // Browser session cookies are cleared even if backend revocation fails.
      }
    }
    const response = NextResponse.json({ authenticated: false, user: null });
    clearAuthCookies(response);
    return response;
  } catch (error) {
    const response = jsonError(error);
    clearAuthCookies(response);
    return response;
  }
}
