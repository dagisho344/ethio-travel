import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  BffAuthError,
  authenticatedBackendJson,
  clearAuthCookies,
  jsonError,
  setAuthCookies,
  validateSameOrigin,
} from '../../../lib/auth/session';

const allowed = ['targetType', 'targetId', 'reason', 'details'] as const;

export async function POST(request: NextRequest) {
  try {
    validateSameOrigin(request);
    const input: unknown = await request.json();
    if (typeof input !== 'object' || input === null || Array.isArray(input)) {
      throw new BffAuthError(400, 'A valid report is required.');
    }
    const source = input as Record<string, unknown>;
    const body = Object.fromEntries(
      allowed
        .filter((key) => Object.prototype.hasOwnProperty.call(source, key))
        .map((key) => [key, source[key]]),
    );
    const result = await authenticatedBackendJson('/reports', {
      body: JSON.stringify(body),
      method: 'POST',
    });
    const response = NextResponse.json(result.data);
    if (result.auth) setAuthCookies(response, result.auth);
    return response;
  } catch (error) {
    const response = jsonError(error);
    if (response.status === 401) clearAuthCookies(response);
    return response;
  }
}
