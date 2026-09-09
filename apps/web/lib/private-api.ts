export class BffRequestError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
  ) {
    super(message);
  }
}

interface BackendErrorShape {
  message?: string | string[];
}

export async function bffJson<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  try {
    const response = await fetch(path, {
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
      const error = data as BackendErrorShape | null;
      const message = Array.isArray(error?.message)
        ? error.message.join(' ')
        : error?.message;
      throw new BffRequestError(message ?? 'Request failed.', response.status);
    }
    return data as T;
  } catch (error) {
    if (error instanceof BffRequestError) throw error;
    throw new BffRequestError('Unable to reach EthioTravel right now.');
  }
}

export function queryString(
  query: Record<string, string | number | boolean | undefined>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const value = params.toString();
  return value ? `?${value}` : '';
}
