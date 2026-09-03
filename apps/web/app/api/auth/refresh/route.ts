import { NextRequest, NextResponse } from 'next/server';
import {
  clearAuthCookies,
  currentTokens,
  jsonError,
  refreshWithBackend,
  setAuthCookies,
  validateSameOrigin,
} from '../../../../lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    validateSameOrigin(request);
    const { refreshToken } = await currentTokens();
    if (!refreshToken) {
      const response = NextResponse.json(
        { authenticated: false, user: null },
        { status: 401 },
      );
      clearAuthCookies(response);
      return response;
    }
    const auth = await refreshWithBackend(refreshToken);
    const response = NextResponse.json({
      authenticated: true,
      user: auth.user,
    });
    setAuthCookies(response, auth);
    return response;
  } catch (error) {
    const response = jsonError(error);
    clearAuthCookies(response);
    return response;
  }
}
