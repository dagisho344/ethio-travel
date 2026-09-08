import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  authenticatedBackendJson,
  clearAuthCookies,
  jsonError,
  setAuthCookies,
} from '../../../../../../lib/auth/session';
import type { Payment } from '../../../../../../lib/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string; paymentId: string }> },
) {
  try {
    const { businessId, paymentId } = await params;
    const result = await authenticatedBackendJson<Payment>(
      `/businesses/${businessId}/payments/${paymentId}`,
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
