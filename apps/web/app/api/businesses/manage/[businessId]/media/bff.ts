import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  BffAuthError,
  authenticatedBackendJson,
  authenticatedBackendResponse,
  clearAuthCookies,
  jsonError,
  setAuthCookies,
  validateSameOrigin,
} from '../../../../../../lib/auth/session';

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const mediaRoles = new Set(['LOGO', 'HERO', 'GALLERY']);

export async function mediaIds(
  params: Promise<{ businessId: string; mediaId?: string }>,
): Promise<{ businessId: string; mediaId?: string }> {
  const value = await params;
  if (
    !uuid.test(value.businessId) ||
    (value.mediaId && !uuid.test(value.mediaId))
  )
    throw new BffAuthError(404, 'Media not found.');
  return value;
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function mediaJsonBody(request: NextRequest, reorder = false) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    throw new BffAuthError(400, 'A valid media request body is required.');
  }
  if (!record(input))
    throw new BffAuthError(400, 'A valid media request body is required.');
  if (reorder) {
    const mediaIds = input.mediaIds;
    if (
      !Array.isArray(mediaIds) ||
      mediaIds.some((id) => typeof id !== 'string')
    )
      throw new BffAuthError(400, 'A valid gallery order is required.');
    return JSON.stringify({ mediaIds });
  }
  const body: Record<string, string | null> = {};
  for (const key of ['altText', 'caption']) {
    const value = input[key];
    if (typeof value === 'string' || value === null) body[key] = value;
  }
  return JSON.stringify(body);
}

export async function mediaResponse<T>(
  request: NextRequest,
  path: string,
  init: RequestInit = {},
  status = 200,
): Promise<NextResponse> {
  try {
    if (init.method && init.method !== 'GET') validateSameOrigin(request);
    const result = await authenticatedBackendJson<T>(path, init);
    const response = NextResponse.json(result.data, { status });
    if (result.auth) setAuthCookies(response, result.auth);
    return response;
  } catch (error) {
    const response = jsonError(error);
    if (response.status === 401) clearAuthCookies(response);
    return response;
  }
}

export async function multipartMediaResponse(
  request: NextRequest,
  path: string,
): Promise<NextResponse> {
  try {
    validateSameOrigin(request);
    const incoming = await request.formData();
    const role = incoming.get('role');
    const file = incoming.get('file');
    if (
      typeof role !== 'string' ||
      !mediaRoles.has(role) ||
      !(file instanceof File)
    )
      throw new BffAuthError(400, 'A valid role and image file are required.');
    const forwarded = new FormData();
    forwarded.set('role', role);
    forwarded.set('file', file, file.name);
    for (const key of ['altText', 'caption']) {
      const value = incoming.get(key);
      if (typeof value === 'string') forwarded.set(key, value);
    }
    const result = await authenticatedBackendResponse(path, {
      method: 'POST',
      body: forwarded,
    });
    const text = await result.response.text();
    const data: unknown = text ? JSON.parse(text) : null;
    const response = NextResponse.json(data, { status: 201 });
    if (result.auth) setAuthCookies(response, result.auth);
    return response;
  } catch (error) {
    const response = jsonError(error);
    if (response.status === 401) clearAuthCookies(response);
    return response;
  }
}
