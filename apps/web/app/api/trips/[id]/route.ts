import type { NextRequest } from 'next/server';
import { requestBody, tripRouteResponse } from '../bff';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return tripRouteResponse(request, `/trips/${id}`);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return tripRouteResponse(request, `/trips/${id}`, {
    method: 'PATCH',
    body: await requestBody(request),
  });
}
