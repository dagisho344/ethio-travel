import type { NextRequest } from 'next/server';
import { requestBody, tripRouteResponse } from '../../../../../bff';

export async function PATCH(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; dayId: string; itemId: string }> },
) {
  const { id, dayId, itemId } = await params;
  return tripRouteResponse(
    request,
    `/trips/${id}/days/${dayId}/items/${itemId}`,
    {
      method: 'PATCH',
      body: await requestBody(request),
    },
  );
}

export async function DELETE(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; dayId: string; itemId: string }> },
) {
  const { id, dayId, itemId } = await params;
  return tripRouteResponse(
    request,
    `/trips/${id}/days/${dayId}/items/${itemId}`,
    { method: 'DELETE' },
    { noContent: true },
  );
}
