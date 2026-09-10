import type { NextRequest } from 'next/server';
import { jsonError } from '../../../../lib/auth/session';
import { businessRequestBody, businessRouteResponse } from './bff';

function managedBusinessesQuery(request: NextRequest): string {
  const query = new URLSearchParams();
  for (const key of ['page', 'limit']) {
    const value = request.nextUrl.searchParams.get(key);
    if (value && /^\d+$/.test(value)) query.set(key, value);
  }
  const q = request.nextUrl.searchParams.get('q')?.trim();
  if (q) query.set('q', q.slice(0, 200));
  return query.toString();
}

export async function GET(request: NextRequest) {
  const query = managedBusinessesQuery(request);
  return businessRouteResponse(
    request,
    `/my/businesses${query ? `?${query}` : ''}`,
  );
}

export async function POST(request: NextRequest) {
  try {
    return businessRouteResponse(
      request,
      '/businesses',
      { method: 'POST', body: await businessRequestBody(request) },
      201,
    );
  } catch (error) {
    return jsonError(error);
  }
}
