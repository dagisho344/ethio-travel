import { NextRequest, NextResponse } from 'next/server';
import {
  jsonError,
  loginWithBackend,
  setAuthCookies,
  validateSameOrigin,
} from '../../../../lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    validateSameOrigin(request);
    const auth = await loginWithBackend(await request.json());
    const response = NextResponse.json({
      authenticated: true,
      user: auth.user,
    });
    setAuthCookies(response, auth);
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
