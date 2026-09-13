import type { NextRequest } from 'next/server';
import { adminResponse } from './bff';
export async function GET(request: NextRequest) {
  return adminResponse(
    request,
    `/admin/business-verifications${request.nextUrl.search}`,
  );
}
