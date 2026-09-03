import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

const API_BASE =
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  'http://localhost:3001/api/v1';

export const ACCESS_COOKIE = 'et_access';
export const REFRESH_COOKIE = 'et_refresh';

const ACCESS_MAX_AGE_SECONDS = 15 * 60;
const REFRESH_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export type SafeUser = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  roles: string[];
};

export type BackendAuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: SafeUser;
};

type BackendError = {
  message?: string | string[];
};

export class BffAuthError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

export function validateSameOrigin(request: NextRequest): void {
  if (SAFE_METHODS.has(request.method)) return;
  const origin = request.headers.get('origin');
  if (!origin || origin !== request.nextUrl.origin) {
    throw new BffAuthError(403, 'Request origin is not allowed.');
  }
}

export function jsonError(error: unknown): NextResponse {
  if (error instanceof BffAuthError) {
    return NextResponse.json(
      { message: error.message },
      { status: error.status },
    );
  }
  return NextResponse.json(
    { message: 'We could not complete that request right now.' },
    { status: 500 },
  );
}

export function authCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  };
}

export function setAuthCookies(
  response: NextResponse,
  auth: BackendAuthResponse,
): void {
  response.cookies.set(
    ACCESS_COOKIE,
    auth.accessToken,
    authCookieOptions(ACCESS_MAX_AGE_SECONDS),
  );
  response.cookies.set(
    REFRESH_COOKIE,
    auth.refreshToken,
    authCookieOptions(REFRESH_MAX_AGE_SECONDS),
  );
}

export function clearAuthCookies(response: NextResponse): void {
  response.cookies.set(ACCESS_COOKIE, '', {
    ...authCookieOptions(0),
    maxAge: 0,
  });
  response.cookies.set(REFRESH_COOKIE, '', {
    ...authCookieOptions(0),
    maxAge: 0,
  });
}

export async function backendJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });
  const text = await response.text();
  const data = text ? (JSON.parse(text) as unknown) : null;
  if (!response.ok) {
    const backendError = data as BackendError | null;
    const message = Array.isArray(backendError?.message)
      ? backendError.message.join(' ')
      : backendError?.message;
    throw new BffAuthError(response.status, message ?? 'Request failed.');
  }
  return data as T;
}

export async function loginWithBackend(
  body: unknown,
): Promise<BackendAuthResponse> {
  return backendJson<BackendAuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function registerWithBackend(body: unknown): Promise<SafeUser> {
  const auth = await backendJson<BackendAuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  try {
    await logoutWithBackend(auth.accessToken);
  } catch {
    // Registration keeps the sign-in-after-create flow; no token is exposed to the browser.
  }
  return auth.user;
}

export async function refreshWithBackend(
  refreshToken: string,
): Promise<BackendAuthResponse> {
  return backendJson<BackendAuthResponse>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}

export async function logoutWithBackend(accessToken: string): Promise<void> {
  await backendJson('/auth/logout', {
    method: 'POST',
    headers: { authorization: `Bearer ${accessToken}` },
  });
}

export async function getMeWithBackend(accessToken: string): Promise<SafeUser> {
  return backendJson<SafeUser>('/users/me', {
    headers: { authorization: `Bearer ${accessToken}` },
  });
}

async function backendJsonWithAccess<T>(
  path: string,
  accessToken: string,
  init: RequestInit = {},
): Promise<T> {
  return backendJson<T>(path, {
    ...init,
    headers: {
      ...(init.headers ?? {}),
      authorization: `Bearer ${accessToken}`,
    },
  });
}

export async function authenticatedBackendJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<{ data: T; auth?: BackendAuthResponse }> {
  const tokens = await currentTokens();

  if (tokens.accessToken) {
    try {
      const data = await backendJsonWithAccess<T>(
        path,
        tokens.accessToken,
        init,
      );
      return { data };
    } catch (error) {
      if (!(error instanceof BffAuthError) || error.status !== 401) {
        throw error;
      }
    }
  }

  if (!tokens.refreshToken) {
    throw new BffAuthError(401, 'Authentication required.');
  }

  const auth = await refreshWithBackend(tokens.refreshToken);
  const data = await backendJsonWithAccess<T>(path, auth.accessToken, init);
  return { data, auth };
}
export async function currentTokens() {
  const store = await cookies();
  return {
    accessToken: store.get(ACCESS_COOKIE)?.value,
    refreshToken: store.get(REFRESH_COOKIE)?.value,
  };
}

export async function currentSessionSnapshot(): Promise<{
  authenticated: boolean;
  user: SafeUser | null;
}> {
  const { accessToken } = await currentTokens();
  if (!accessToken) return { authenticated: false, user: null };
  try {
    const user = await getMeWithBackend(accessToken);
    return { authenticated: true, user };
  } catch {
    return { authenticated: false, user: null };
  }
}
export async function authenticatedMeResponse(): Promise<NextResponse> {
  const tokens = await currentTokens();
  if (tokens.accessToken) {
    try {
      const user = await getMeWithBackend(tokens.accessToken);
      return NextResponse.json({ authenticated: true, user });
    } catch (error) {
      if (!(error instanceof BffAuthError) || error.status !== 401) throw error;
    }
  }

  if (!tokens.refreshToken) {
    const response = NextResponse.json({ authenticated: false, user: null });
    clearAuthCookies(response);
    return response;
  }

  try {
    const auth = await refreshWithBackend(tokens.refreshToken);
    const user = await getMeWithBackend(auth.accessToken);
    const response = NextResponse.json({ authenticated: true, user });
    setAuthCookies(response, auth);
    return response;
  } catch {
    const response = NextResponse.json({ authenticated: false, user: null });
    clearAuthCookies(response);
    return response;
  }
}
