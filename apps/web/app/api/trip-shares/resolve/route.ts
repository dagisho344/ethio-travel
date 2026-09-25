import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  BffAuthError,
  backendJson,
  validateSameOrigin,
} from '../../../../lib/auth/session';

const tokenPattern = /^[A-Za-z0-9_-]{64}$/;
const noStoreHeaders = {
  'Cache-Control': 'private, no-store, max-age=0',
  Pragma: 'no-cache',
  'Referrer-Policy': 'no-referrer',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
};

function badRequest(message: string): NextResponse {
  return NextResponse.json(
    { message },
    { status: 400, headers: noStoreHeaders },
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    validateSameOrigin(request);
    const value: unknown = await request.json();
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.keys(value).length !== 1 ||
      !('token' in value) ||
      typeof value.token !== 'string' ||
      !tokenPattern.test(value.token)
    ) {
      return badRequest('Invalid share link.');
    }
    const data = await backendJson<unknown>('/trip-shares/resolve', {
      method: 'POST',
      body: JSON.stringify({ token: value.token }),
    });
    return NextResponse.json(data, { headers: noStoreHeaders });
  } catch (error) {
    if (error instanceof BffAuthError) {
      const status = error.status === 404 ? 404 : error.status;
      const message = status === 404 ? 'Shared trip not found.' : error.message;
      return NextResponse.json(
        { message },
        { status, headers: noStoreHeaders },
      );
    }
    return NextResponse.json(
      { message: 'We could not open this shared trip right now.' },
      { status: 500, headers: noStoreHeaders },
    );
  }
}
