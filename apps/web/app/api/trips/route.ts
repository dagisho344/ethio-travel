import type { NextRequest } from 'next/server';
import { requestBody, tripRouteResponse } from './bff';

const allowedStatuses = new Set([
  'DRAFT',
  'UPCOMING',
  'IN_PROGRESS',
  'COMPLETED',
  'ARCHIVED',
]);
const allowedTiming = new Set(['UPCOMING', 'PAST']);
const allowedSort = new Set(['NEWEST', 'SOONEST', 'RECENTLY_UPDATED']);

function tripQuery(request: NextRequest): string {
  const source = request.nextUrl.searchParams;
  const query = new URLSearchParams();
  for (const key of ['page', 'limit']) {
    const value = source.get(key);
    if (value) query.set(key, value);
  }
  const status = source.get('status');
  const timing = source.get('timing');
  const sort = source.get('sort');
  if (status && allowedStatuses.has(status)) query.set('status', status);
  if (timing && allowedTiming.has(timing)) query.set('timing', timing);
  if (sort && allowedSort.has(sort)) query.set('sort', sort);
  return query.toString();
}

export async function GET(request: NextRequest) {
  const query = tripQuery(request);
  return tripRouteResponse(
    request,
    `/users/me/trips${query ? `?${query}` : ''}`,
  );
}

export async function POST(request: NextRequest) {
  return tripRouteResponse(
    request,
    '/trips',
    {
      method: 'POST',
      body: await requestBody(request),
    },
    { status: 201 },
  );
}
