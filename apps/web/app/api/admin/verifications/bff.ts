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
} from '../../../../lib/auth/session';

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export async function adminIds(
  params: Promise<{ verificationId: string; documentId?: string }>,
): Promise<{ verificationId: string; documentId?: string }> {
  const value = await params;
  if (
    !uuid.test(value.verificationId) ||
    (value.documentId && !uuid.test(value.documentId))
  )
    throw new BffAuthError(404, 'Verification not found.');
  return value;
}
export async function adminResponse<T>(
  request: NextRequest,
  path: string,
  init: RequestInit = {},
) {
  try {
    if (init.method && init.method !== 'GET') validateSameOrigin(request);
    const result = await authenticatedBackendJson<T>(path, init);
    const response = NextResponse.json(result.data);
    if (result.auth) setAuthCookies(response, result.auth);
    return response;
  } catch (error) {
    const response = jsonError(error);
    if (response.status === 401) clearAuthCookies(response);
    return response;
  }
}
export async function adminMutationBody(
  request: NextRequest,
  reject = false,
): Promise<string> {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    throw new BffAuthError(400, 'A valid review body is required.');
  }
  if (!record(input))
    throw new BffAuthError(400, 'A valid review body is required.');
  const body: Record<string, string> = {};
  if (typeof input.adminNotes === 'string') body.adminNotes = input.adminNotes;
  if (reject && typeof input.rejectionReason === 'string')
    body.rejectionReason = input.rejectionReason;
  return JSON.stringify(body);
}
export async function adminContentResponse(
  request: NextRequest,
  path: string,
): Promise<NextResponse> {
  try {
    const result = await authenticatedBackendResponse(path);
    const headers = new Headers();
    for (const name of [
      'content-type',
      'content-length',
      'content-disposition',
      'cache-control',
      'x-content-type-options',
    ]) {
      const value = result.response.headers.get(name);
      if (value) headers.set(name, value);
    }
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
