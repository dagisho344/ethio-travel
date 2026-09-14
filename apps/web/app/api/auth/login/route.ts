import { NextRequest, NextResponse } from 'next/server';
import {
  hasBusinessWorkspaceWithBackend,
  jsonError,
  loginWithBackend,
  setAuthCookies,
  validateSameOrigin,
} from '../../../../lib/auth/session';

export async function POST(request: NextRequest) {
  try {
    validateSameOrigin(request);
    const auth = await loginWithBackend(await request.json());
    const hasBusinessWorkspace = await hasBusinessWorkspaceWithBackend(
      auth.accessToken,
      auth.user,
    );
    const response = NextResponse.json({
      authenticated: true,
      user: auth.user,
      hasBusinessWorkspace,
    });
    setAuthCookies(response, auth);
    return response;
  } catch (error) {
    return jsonError(error);
  }
}
