import type { ApiErrorShape, PaginatedResponse } from './types';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

function buildUrl(
  path: string,
  query?: Record<string, string | number | undefined | null>,
): string {
  const url = new URL(`${API_BASE}${path.startsWith('/') ? path : `/${path}`}`);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '')
      url.searchParams.set(key, String(value));
  });
  return url.toString();
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  query?: Record<string, string | number | undefined | null>,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(buildUrl(path, query), {
      ...init,
      headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
      cache: 'no-store',
      signal: controller.signal,
    });
    const text = await response.text();
    const data = text ? (JSON.parse(text) as unknown) : null;
    if (!response.ok) {
      const error = data as ApiErrorShape | null;
      const message = Array.isArray(error?.message)
        ? error.message.join(' ')
        : error?.message;
      throw new ApiError(message ?? 'Request failed', response.status);
    }
    return data as T;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === 'AbortError')
      throw new ApiError('The request timed out.');
    throw new ApiError('Unable to reach EthioTravel API.');
  } finally {
    clearTimeout(timeout);
  }
}

export async function getJson<T>(
  path: string,
  query?: Record<string, string | number | undefined | null>,
): Promise<T> {
  return request<T>(path, {}, query);
}
export async function postJson<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: 'POST', body: JSON.stringify(body) });
}
export async function safePage<T>(
  path: string,
  query?: Record<string, string | number | undefined | null>,
): Promise<PaginatedResponse<T> | null> {
  try {
    return await getJson<PaginatedResponse<T>>(path, query);
  } catch {
    return null;
  }
}
