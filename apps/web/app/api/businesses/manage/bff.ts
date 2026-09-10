import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  BffAuthError,
  authenticatedBackendJson,
  clearAuthCookies,
  jsonError,
  setAuthCookies,
  validateSameOrigin,
} from '../../../../lib/auth/session';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function optionalString(
  input: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = input[key];
  return typeof value === 'string' ? value : undefined;
}

function optionalNumber(
  input: Record<string, unknown>,
  key: string,
): number | undefined {
  const value = input[key];
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
}

export async function businessRequestBody(
  request: NextRequest,
): Promise<string> {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    throw new BffAuthError(400, 'A valid business request body is required.');
  }
  if (!isRecord(input))
    throw new BffAuthError(400, 'A valid business request body is required.');

  const body: Record<string, string | number> = {};
  for (const key of [
    'cityId',
    'destinationId',
    'categoryId',
    'name',
    'description',
    'phone',
    'email',
    'website',
    'addressLine1',
    'addressLine2',
    'neighborhood',
    'postalCode',
  ]) {
    const value = optionalString(input, key);
    if (value !== undefined) body[key] = value;
  }
  for (const key of ['latitude', 'longitude']) {
    const value = optionalNumber(input, key);
    if (value !== undefined) body[key] = value;
  }
  return JSON.stringify(body);
}

export async function businessRouteResponse<T>(
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
