import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  BffAuthError,
  authenticatedBackendJson,
  clearAuthCookies,
  jsonError,
  setAuthCookies,
  validateSameOrigin,
} from '../../../../../lib/auth/session';

export type ManagedRouteContext = { params: Promise<{ businessId: string }> };
const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isManagedUuid(value: string): boolean {
  return uuid.test(value);
}

export async function managedPath(
  context: ManagedRouteContext,
  suffix: string,
): Promise<string> {
  const { businessId } = await context.params;
  if (!isManagedUuid(businessId))
    throw new BffAuthError(404, 'Business not found.');
  return `/my/businesses/${businessId}${suffix}`;
}

export async function managedResponse<T>(
  request: NextRequest,
  path: string,
  init: RequestInit = {},
): Promise<NextResponse> {
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

export async function allowedJsonBody(
  request: NextRequest,
  keys: readonly string[],
): Promise<string> {
  const input: unknown = await request.json().catch(() => null);
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new BffAuthError(400, 'A valid request body is required.');
  }
  const record = input as Record<string, unknown>;
  const body: Record<string, string | number | boolean | null> = {};
  for (const key of keys) {
    const value = record[key];
    if (
      typeof value === 'string' ||
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      value === null
    ) {
      body[key] = value;
    }
  }
  return JSON.stringify(body);
}

export async function strictAllowedJsonBody(
  request: NextRequest,
  keys: readonly string[],
): Promise<string> {
  const input: unknown = await request.json().catch(() => null);
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new BffAuthError(400, 'A valid request body is required.');
  }
  const record = input as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (!keys.includes(key)) {
      throw new BffAuthError(400, `Unsupported field: ${key}.`);
    }
  }
  const body: Record<string, string | number | boolean | null> = {};
  for (const key of keys) {
    const value = record[key];
    if (value === undefined) continue;
    if (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'boolean' &&
      value !== null
    ) {
      throw new BffAuthError(400, `Invalid value for ${key}.`);
    }
    body[key] = value;
  }
  return JSON.stringify(body);
}

export async function strictAllowedJsonBodyWithStringArrays(
  request: NextRequest,
  scalarKeys: readonly string[],
  stringArrayKeys: readonly string[],
): Promise<string> {
  const input: unknown = await request.json().catch(() => null);
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new BffAuthError(400, 'A valid request body is required.');
  }
  const record = input as Record<string, unknown>;
  const allowedKeys = new Set([...scalarKeys, ...stringArrayKeys]);
  for (const key of Object.keys(record)) {
    if (!allowedKeys.has(key)) {
      throw new BffAuthError(400, `Unsupported field: ${key}.`);
    }
  }

  const body: Record<string, string | number | boolean | null | string[]> = {};
  for (const key of scalarKeys) {
    const value = record[key];
    if (value === undefined) continue;
    if (
      typeof value !== 'string' &&
      typeof value !== 'number' &&
      typeof value !== 'boolean' &&
      value !== null
    ) {
      throw new BffAuthError(400, `Invalid value for ${key}.`);
    }
    body[key] = value;
  }
  for (const key of stringArrayKeys) {
    const value = record[key];
    if (value === undefined) continue;
    if (
      !Array.isArray(value) ||
      !value.every((item) => typeof item === 'string')
    ) {
      throw new BffAuthError(400, `Invalid string array for ${key}.`);
    }
    body[key] = value;
  }
  return JSON.stringify(body);
}
export function queryFrom(
  request: NextRequest,
  keys: readonly string[],
): string {
  const query = new URLSearchParams();
  for (const key of keys) {
    const value = request.nextUrl.searchParams.get(key);
    if (value) query.set(key, value);
  }
  return query.toString();
}
