import type { NextRequest } from 'next/server';
import { requestBody, tripRouteResponse } from '../../../../bff';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; dayId: string }> },
) {
  const { id, dayId } = await params;
  return tripRouteResponse(
    request,
    `/trips/${id}/days/${dayId}/items`,
    {
      method: 'POST',
      body: await requestBody(request),
    },
    { status: 201 },
  );
}
