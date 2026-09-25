import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { tripRouteResponse } from '../../bff';

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function badRequest(message: string): NextResponse {
  return NextResponse.json({ message }, { status: 400 });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

export function validTripId(value: string): boolean {
  return uuidPattern.test(value);
}

export async function expirationBody(
  request: NextRequest,
  options: { required: boolean },
): Promise<{ expiresAt?: string | null } | NextResponse> {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return badRequest('Invalid JSON body.');
  }
  if (!isObject(input)) return badRequest('JSON body must be an object.');
  if (!Object.keys(input).every((key) => key === 'expiresAt')) {
    return badRequest('Unexpected share-link field.');
  }
  if (options.required && !('expiresAt' in input)) {
    return badRequest('An expiration value is required.');
  }
  if (
    input.expiresAt !== undefined &&
    input.expiresAt !== null &&
    typeof input.expiresAt !== 'string'
  ) {
    return badRequest('Share expiration must be text or null.');
  }
  return {
    expiresAt:
      typeof input.expiresAt === 'string' || input.expiresAt === null
        ? input.expiresAt
        : undefined,
  };
}

export async function shareRouteResponse(
  request: NextRequest,
  tripId: string,
  suffix = '',
  init: RequestInit = {},
  options: { status?: number; noContent?: boolean } = {},
): Promise<NextResponse> {
  if (!validTripId(tripId)) return badRequest('Invalid trip ID.');
  return tripRouteResponse(
    request,
    `/trips/${tripId}/share${suffix}`,
    init,
    options,
  );
}
