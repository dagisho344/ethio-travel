import type { NextRequest } from 'next/server';
import { aiRouteResponse, requestBody } from '../bff';

function query(request: NextRequest): string {
  const params = new URLSearchParams();
  for (const key of ['page', 'limit']) {
    const value = request.nextUrl.searchParams.get(key);
    if (value) params.set(key, value);
  }
  const value = params.toString();
  return value ? `?${value}` : '';
}

export async function GET(request: NextRequest) {
  return aiRouteResponse(request, `/ai/conversations${query(request)}`);
}

export async function POST(request: NextRequest) {
  return aiRouteResponse(
    request,
    '/ai/conversations',
    { method: 'POST', body: await requestBody(request) },
    201,
  );
}
