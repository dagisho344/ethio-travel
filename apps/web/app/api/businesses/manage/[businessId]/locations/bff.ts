import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  BffAuthError,
  authenticatedBackendJson,
  clearAuthCookies,
  jsonError,
  setAuthCookies,
  validateSameOrigin,
} from '../../../../../../lib/auth/session';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function locationBody(
  request: NextRequest,
  hours = false,
): Promise<string> {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    throw new BffAuthError(400, 'A valid location request body is required.');
  }
  if (!isRecord(input))
    throw new BffAuthError(400, 'A valid location request body is required.');
  if (hours) {
    const rawHours = input.hours;
    if (!Array.isArray(rawHours))
      throw new BffAuthError(400, 'A weekly hours array is required.');
    const normalized = rawHours.map((hour) => {
      if (
        !isRecord(hour) ||
        typeof hour.dayOfWeek !== 'string' ||
        typeof hour.isClosed !== 'boolean'
      ) {
        throw new BffAuthError(400, 'Each operating-hours entry is invalid.');
      }
      const opensAt = typeof hour.opensAt === 'string' ? hour.opensAt : null;
      const closesAt = typeof hour.closesAt === 'string' ? hour.closesAt : null;
      return {
        dayOfWeek: hour.dayOfWeek,
        isClosed: hour.isClosed,
        opensAt,
        closesAt,
      };
    });
    return JSON.stringify({ hours: normalized });
  }
  const body: Record<string, string | number | null> = {};
  const nullableTextKeys = new Set([
    'destinationId',
    'addressLine2',
    'neighborhood',
    'postalCode',
  ]);
  for (const key of [
    'label',
    'cityId',
    'destinationId',
    'addressLine1',
    'addressLine2',
    'neighborhood',
    'postalCode',
    'timezone',
    'status',
  ]) {
    const value = input[key];
    if (
      typeof value === 'string' ||
      (value === null && nullableTextKeys.has(key))
    ) {
      body[key] = value;
    }
  }
  for (const key of ['latitude', 'longitude']) {
    const value = input[key];
    if (typeof value === 'number' && Number.isFinite(value)) body[key] = value;
  }
  return JSON.stringify(body);
}

export async function locationResponse<T>(
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

export async function locationPath(
  params: Promise<{ businessId: string; locationId?: string }>,
): Promise<{ businessId: string; locationId?: string }> {
  const value = await params;
  const uuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (
    !uuid.test(value.businessId) ||
    (value.locationId && !uuid.test(value.locationId))
  )
    throw new BffAuthError(404, 'Location not found.');
  return value;
}
