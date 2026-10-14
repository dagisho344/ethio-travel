import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  BffAuthError,
  authenticatedBackendResponse,
  clearAuthCookies,
  jsonError,
  setAuthCookies,
  validateSameOrigin,
} from '../../../../../../lib/auth/session';
import { adminUuid } from '../../../bff';

const roles = new Set(['HERO', 'GALLERY']);
const imageTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);
const maxImageBytes = 10 * 1024 * 1024;

export function destinationMediaIds(destinationId: string, mediaId?: string) {
  return {
    destinationId: adminUuid(destinationId, 'Destination'),
    ...(mediaId !== undefined ? { mediaId: adminUuid(mediaId, 'Media') } : {}),
  };
}

function object(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function requestObject(request: NextRequest) {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    throw new BffAuthError(400, 'A valid media request is required.');
  }
  if (!object(input))
    throw new BffAuthError(400, 'A valid media request is required.');
  return input;
}

export async function destinationMediaMetadataBody(request: NextRequest) {
  validateSameOrigin(request);
  const input = await requestObject(request);
  if (
    !Object.keys(input).length ||
    Object.keys(input).some((key) => !['altText', 'caption'].includes(key))
  )
    throw new BffAuthError(400, 'Only image alt text and caption may change.');
  const body: { altText?: string | null; caption?: string | null } = {};
  for (const [key, max] of [
    ['altText', 240],
    ['caption', 500],
  ] as const) {
    if (!(key in input)) continue;
    const value = input[key];
    if (value !== null && (typeof value !== 'string' || value.length > max))
      throw new BffAuthError(400, 'Invalid image metadata.');
    body[key] = value;
  }
  return JSON.stringify(body);
}

export async function destinationMediaReorderBody(request: NextRequest) {
  validateSameOrigin(request);
  const input = await requestObject(request);
  if (Object.keys(input).some((key) => key !== 'mediaIds'))
    throw new BffAuthError(400, 'Only gallery media IDs may be reordered.');
  const ids = input.mediaIds;
  if (
    !Array.isArray(ids) ||
    ids.length > 12 ||
    ids.some((id) => typeof id !== 'string' || !isUuid(id)) ||
    new Set(ids).size !== ids.length
  )
    throw new BffAuthError(400, 'A valid gallery order is required.');
  return JSON.stringify({ mediaIds: ids });
}

export async function destinationMediaNoBody(request: NextRequest) {
  validateSameOrigin(request);
  if ((await request.text()).trim())
    throw new BffAuthError(400, 'This action does not accept a body.');
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function destinationMediaUpload(
  request: NextRequest,
  path: string,
): Promise<NextResponse> {
  try {
    validateSameOrigin(request);
    const declaredLength = Number(request.headers.get('content-length'));
    if (Number.isFinite(declaredLength) && declaredLength > 11 * 1024 * 1024)
      throw new BffAuthError(413, 'Image upload is too large.');
    let incoming: FormData;
    try {
      incoming = await request.formData();
    } catch {
      throw new BffAuthError(400, 'A valid image upload is required.');
    }
    if (
      [...incoming.keys()].some(
        (key) => !['file', 'role', 'altText', 'caption'].includes(key),
      ) ||
      ['file', 'role', 'altText', 'caption'].some(
        (key) => incoming.getAll(key).length > 1,
      )
    )
      throw new BffAuthError(400, 'The upload contains an unsupported field.');
    const role = incoming.get('role');
    const file = incoming.get('file');
    if (
      typeof role !== 'string' ||
      !roles.has(role) ||
      !(file instanceof File) ||
      !imageTypes.has(file.type) ||
      file.size < 1 ||
      file.size > maxImageBytes
    )
      throw new BffAuthError(400, 'A JPEG, PNG, or WebP image is required.');
    const forwarded = new FormData();
    forwarded.set('role', role);
    forwarded.set('file', file, file.name);
    for (const [key, max] of [
      ['altText', 240],
      ['caption', 500],
    ] as const) {
      const value = incoming.get(key);
      if (value === null) continue;
      if (typeof value !== 'string' || value.length > max)
        throw new BffAuthError(400, 'Invalid image metadata.');
      forwarded.set(key, value);
    }
    const result = await authenticatedBackendResponse(path, {
      method: 'POST',
      body: forwarded,
    });
    const data: unknown = await result.response.json();
    const response = NextResponse.json(data, { status: 201 });
    if (result.auth) setAuthCookies(response, result.auth);
    return response;
  } catch (error) {
    const response = jsonError(error);
    if (response.status === 401) clearAuthCookies(response);
    return response;
  }
}

export async function destinationMediaContent(
  path: string,
): Promise<NextResponse> {
  try {
    const result = await authenticatedBackendResponse(path);
    const headers = new Headers();
    for (const name of [
      'content-type',
      'content-length',
      'x-content-type-options',
    ]) {
      const value = result.response.headers.get(name);
      if (value) headers.set(name, value);
    }
    headers.set('Cache-Control', 'no-store');
    const response = new NextResponse(await result.response.arrayBuffer(), {
      headers,
    });
    if (result.auth) setAuthCookies(response, result.auth);
    return response;
  } catch (error) {
    const response = jsonError(error);
    if (response.status === 401) clearAuthCookies(response);
    return response;
  }
}
