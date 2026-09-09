import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  authenticatedBackendJson,
  clearAuthCookies,
  jsonError,
  setAuthCookies,
  validateSameOrigin,
} from '../../../../../lib/auth/session';

function messagesQuery(request: NextRequest): string {
  const query = new URLSearchParams();
  for (const key of ['page', 'limit']) {
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const result = await authenticatedBackendJson(
      `/conversations/${id}/messages${messagesQuery(request)}`,
    );
    const response = NextResponse.json(result.data);
    if (result.auth) setAuthCookies(response, result.auth);
    return response;
  } catch (error) {
    return failure(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    validateSameOrigin(request);
    const { id } = await params;
    const result = await authenticatedBackendJson(
      `/conversations/${id}/messages`,
      {
        method: 'POST',
        body: JSON.stringify(await request.json()),
      },
    );
    const response = NextResponse.json(result.data, { status: 201 });
    if (result.auth) setAuthCookies(response, result.auth);
    return response;
  } catch (error) {
    return failure(error);
  }
}
