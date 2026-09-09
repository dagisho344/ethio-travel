import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  authenticatedBackendJson,
  clearAuthCookies,
  jsonError,
  setAuthCookies,
  validateSameOrigin,
} from '../../../lib/auth/session';

function conversationQuery(request: NextRequest): string {
  const query = new URLSearchParams();
  for (const key of ['page', 'limit', 'status', 'businessId']) {
    const value = request.nextUrl.searchParams.get(key);
    if (value) query.set(key, value);
  }
  const value = query.toString();
  return value ? `?${value}` : '';
}

function failure(error: unknown) {
  const response = jsonError(error);
  if (response.status === 401) clearAuthCookies(response);
  return response;
}

export async function GET(request: NextRequest) {
  try {
    const result = await authenticatedBackendJson(
      `/conversations${conversationQuery(request)}`,
    );
    const response = NextResponse.json(result.data);
    if (result.auth) setAuthCookies(response, result.auth);
    return response;
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    validateSameOrigin(request);
    const result = await authenticatedBackendJson('/conversations', {
      method: 'POST',
      body: JSON.stringify(await request.json()),
    });
    const response = NextResponse.json(result.data, { status: 201 });
    if (result.auth) setAuthCookies(response, result.auth);
    return response;
  } catch (error) {
    return failure(error);
  }
}
