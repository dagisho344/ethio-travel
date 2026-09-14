import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  authenticatedBackendJson,
  clearAuthCookies,
  jsonError,
  setAuthCookies,
  validateSameOrigin,
} from '../../../../../../../lib/auth/session';

const allowedActions = new Set([
  'confirm',
  'reject',
  'cancel',
  'complete',
  'no-show',
]);

async function actionBody(request: NextRequest): Promise<string> {
  const input: unknown = await request.json().catch(() => null);
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    return '{}';
  }
  const note = (input as Record<string, unknown>).note;
  return JSON.stringify(typeof note === 'string' ? { note } : {});
}

export async function POST(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ businessId: string; id: string; action: string }> },
) {
  try {
    validateSameOrigin(request);
    const { businessId, id, action } = await params;
    if (!allowedActions.has(action)) {
      return NextResponse.json(
        { message: 'Unsupported booking action.' },
        { status: 404 },
      );
    }
    const result = await authenticatedBackendJson(
      `/businesses/${businessId}/bookings/${id}/${action}`,
      {
        method: 'POST',
        body: await actionBody(request),
      },
    );
    const response = NextResponse.json(result.data);
    if (result.auth) setAuthCookies(response, result.auth);
    return response;
  } catch (error) {
    const response = jsonError(error);
    if (response.status === 401) clearAuthCookies(response);
    return response;
  }
}
