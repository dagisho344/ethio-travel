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

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function adminUuid(value: string, label = 'Record'): string {
  if (!uuid.test(value)) throw new BffAuthError(404, `${label} not found.`);
  return value;
}

export function safeAdminQuery(
  request: NextRequest,
  allowed: readonly string[],
): string {
  const query = new URLSearchParams();
  for (const key of allowed) {
    const value = request.nextUrl.searchParams.get(key);
    if (value) query.set(key, value);
  }
  const encoded = query.toString();
  return encoded ? `?${encoded}` : '';
}

export function adminError(error: unknown): NextResponse {
  return jsonError(error);
}

export async function adminJson<T>(
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

export async function adminReasonBody(request: NextRequest): Promise<string> {
  const input = await adminObject(request, 'A reason is required.');
  if (
    typeof input !== 'object' ||
    input === null ||
    Array.isArray(input) ||
    typeof (input as { reason?: unknown }).reason !== 'string'
  ) {
    throw new BffAuthError(400, 'A reason is required.');
  }
  const reason = (input as { reason: string }).reason.trim();
  if (reason.length < 3 || reason.length > 1000) {
    throw new BffAuthError(
      400,
      'A reason must be between 3 and 1000 characters.',
    );
  }
  return JSON.stringify({ reason });
}

export async function adminModerationNoteBody(
  request: NextRequest,
): Promise<string> {
  const input = await adminObject(request, 'A moderation reason is required.');
  const note = input.moderationNote;
  if (typeof note !== 'string') {
    throw new BffAuthError(400, 'A moderation reason is required.');
  }
  const moderationNote = note.trim();
  if (moderationNote.length < 3 || moderationNote.length > 1000) {
    throw new BffAuthError(
      400,
      'A moderation reason must be between 3 and 1000 characters.',
    );
  }
  return JSON.stringify({ moderationNote });
}

export async function adminResolutionBody(
  request: NextRequest,
): Promise<string> {
  const input = await adminObject(request, 'A resolution is required.');
  const value = input.resolution;
  if (typeof value !== 'string') {
    throw new BffAuthError(400, 'A resolution is required.');
  }
  const resolution = value.trim();
  if (resolution.length < 3 || resolution.length > 1000) {
    throw new BffAuthError(
      400,
      'A resolution must be between 3 and 1000 characters.',
    );
  }
  return JSON.stringify({ resolution });
}

export async function adminAllowedBody(
  request: NextRequest,
  allowed: readonly string[],
): Promise<string> {
  const input = await adminObject(request, 'A valid request body is required.');
  const body = Object.fromEntries(
    allowed
      .filter((key) => Object.prototype.hasOwnProperty.call(input, key))
      .map((key) => [key, input[key]]),
  );
  if (!Object.keys(body).length) {
    throw new BffAuthError(400, 'At least one allowed field is required.');
  }
  return JSON.stringify(body);
}

async function adminObject(
  request: NextRequest,
  message: string,
): Promise<Record<string, unknown>> {
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    throw new BffAuthError(400, message);
  }
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new BffAuthError(400, message);
  }
  return input as Record<string, unknown>;
}
