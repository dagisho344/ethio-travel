import type { NextRequest } from 'next/server';
import { tripRouteResponse } from '../../bff';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return tripRouteResponse(request, `/trips/${id}/archive`, { method: 'POST' });
}
