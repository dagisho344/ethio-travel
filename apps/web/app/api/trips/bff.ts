import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  authenticatedBackendJson,
  clearAuthCookies,
  jsonError,
  setAuthCookies,
  validateSameOrigin,
} from '../../../lib/auth/session';

export async function tripRouteResponse<T>(
  request: NextRequest,
  path: string,
  init: RequestInit = {},
  options: { status?: number; noContent?: boolean } = {},
): Promise<NextResponse> {
  try {
    if (init.method && init.method !== 'GET') validateSameOrigin(request);
    const result = await authenticatedBackendJson<T>(path, init);
    const response = options.noContent
      ? new NextResponse(null, { status: 204 })
      : NextResponse.json(result.data, { status: options.status ?? 200 });
    if (result.auth) setAuthCookies(response, result.auth);
    return response;
  } catch (error) {
    const response = jsonError(error);
    if (response.status === 401) clearAuthCookies(response);
    return response;
  }
}

export async function requestBody(request: NextRequest): Promise<string> {
  return JSON.stringify((await request.json()) as unknown);
}
