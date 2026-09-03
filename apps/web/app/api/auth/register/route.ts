import { NextRequest, NextResponse } from 'next/server';
import {
  clearAuthCookies,
  jsonError,
  registerWithBackend,
  validateSameOrigin,
} from '../../../../lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    validateSameOrigin(request);
    const user = await registerWithBackend(await request.json());
    const response = NextResponse.json({ authenticated: false, user });
    clearAuthCookies(response);
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
