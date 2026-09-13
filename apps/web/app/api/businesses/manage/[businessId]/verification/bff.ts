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
const documentTypes = new Set([
  'BUSINESS_LICENSE',
  'TAX_DOCUMENT',
  'OWNER_ID',
  'ADDRESS_PROOF',
  'OTHER',
]);

export async function verificationIds(
  params: Promise<{ businessId: string; verificationId?: string }>,
): Promise<{ businessId: string; verificationId?: string }> {
  const value = await params;
  if (
    !uuid.test(value.businessId) ||
    (value.verificationId && !uuid.test(value.verificationId))
  )
    throw new BffAuthError(404, 'Verification not found.');
  return value;
}

export async function verificationResponse<T>(
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

export async function verificationMultipartResponse(
  request: NextRequest,
  path: string,
): Promise<NextResponse> {
  try {
    validateSameOrigin(request);
    const incoming = await request.formData();
    const type = incoming.get('type');
    const file = incoming.get('file');
    if (
      typeof type !== 'string' ||
      !documentTypes.has(type) ||
      !(file instanceof File)
    )
      throw new BffAuthError(
        400,
        'A valid document type and file are required.',
      );
    const forwarded = new FormData();
    forwarded.set('type', type);
    forwarded.set('file', file, file.name);
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
