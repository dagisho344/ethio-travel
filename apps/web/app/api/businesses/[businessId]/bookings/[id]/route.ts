import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import {
  authenticatedBackendJson,
  clearAuthCookies,
  jsonError,
  setAuthCookies,
} from '../../../../../../lib/auth/session';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ businessId: string; id: string }> },
) {
  try {
    const { businessId, id } = await params;
    const result = await authenticatedBackendJson(
      `/businesses/${businessId}/bookings/${id}`,
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
