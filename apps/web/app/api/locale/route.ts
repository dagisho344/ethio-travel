import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  isAppLocale,
  localeCookieName,
  localeCookieOptions,
} from '../../../i18n/config';
import { BffAuthError, validateSameOrigin } from '../../../lib/auth/session';

function invalidLocaleResponse(): NextResponse {
  return NextResponse.json(
    { message: 'Locale must be either en or am.' },
    { status: 400 },
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    validateSameOrigin(request);
    const input: unknown = await request.json();

    if (
      !input ||
      typeof input !== 'object' ||
      Array.isArray(input) ||
      Object.keys(input).length !== 1 ||
      !('locale' in input) ||
      !isAppLocale(input.locale)
    ) {
      return invalidLocaleResponse();
    }

    const response = NextResponse.json({ locale: input.locale });
    response.cookies.set(localeCookieName, input.locale, localeCookieOptions);
    return response;
  } catch (error) {
    if (error instanceof BffAuthError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status },
      );
    }
    return invalidLocaleResponse();
  }
}
