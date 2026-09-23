import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  authenticatedBackendJson,
  clearAuthCookies,
  BffAuthError,
  jsonError,
  setAuthCookies,
  type SafeUser,
  validateSameOrigin,
} from '../../../lib/auth/session';

const profileFieldLimits = {
  firstName: 100,
  lastName: 100,
  phone: 32,
} as const;

type ProfileField = keyof typeof profileFieldLimits;
type ProfileUpdate = Partial<Record<ProfileField, string>>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isProfileField(value: string): value is ProfileField {
  return Object.prototype.hasOwnProperty.call(profileFieldLimits, value);
}

async function profileUpdateBody(request: NextRequest): Promise<ProfileUpdate> {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    throw new BffAuthError(400, 'Profile changes must be valid JSON.');
  }

  if (!isRecord(input)) {
    throw new BffAuthError(400, 'Profile changes must be an object.');
  }

  const keys = Object.keys(input);
  if (keys.length === 0) {
    throw new BffAuthError(400, 'Provide at least one profile change.');
  }

  const update: ProfileUpdate = {};
  for (const key of keys) {
    if (!isProfileField(key)) {
      throw new BffAuthError(400, `Profile field ${key} is not allowed.`);
    }

    const value = input[key];
    if (typeof value !== 'string') {
      throw new BffAuthError(400, `Profile field ${key} must be text.`);
    }

    const normalized = value.trim();
    if (normalized.length > profileFieldLimits[key]) {
      throw new BffAuthError(
        400,
        `Profile field ${key} is too long for this account.`,
      );
    }
    update[key] = normalized;
  }

  return update;
}

async function accountResponse(
  path: '/users/me',
  init: RequestInit = {},
): Promise<NextResponse> {
  try {
    const result = await authenticatedBackendJson<SafeUser>(path, init);
    const response = NextResponse.json(result.data);
    if (result.auth) setAuthCookies(response, result.auth);
    return response;
  } catch (error) {
    const response = jsonError(error);
    if (response.status === 401) clearAuthCookies(response);
    return response;
  }
}

export async function GET() {
  return accountResponse('/users/me');
}

export async function PATCH(request: NextRequest) {
  try {
    validateSameOrigin(request);
    const body = await profileUpdateBody(request);
    return accountResponse('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  } catch (error) {
    const response = jsonError(error);
    if (response.status === 401) clearAuthCookies(response);
    return response;
  }
}
