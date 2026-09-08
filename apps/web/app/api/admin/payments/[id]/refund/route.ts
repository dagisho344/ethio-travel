import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  authenticatedBackendJson,
  clearAuthCookies,
  jsonError,
  setAuthCookies,
  validateSameOrigin,
} from '../../../../../../lib/auth/session';
import {
  idempotencyHeader,
  readOptionalJson,
  refundCreateBody,
} from '../../../../../../lib/payment-bff';
import type { Payment } from '../../../../../../lib/types';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    validateSameOrigin(request);
    const { id } = await params;
    const body = refundCreateBody(await readOptionalJson(request));
    const result = await authenticatedBackendJson<Payment>(
      `/admin/payments/${id}/refund`,
      {
        method: 'POST',
        headers: idempotencyHeader(request),
        body: JSON.stringify(body),
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
