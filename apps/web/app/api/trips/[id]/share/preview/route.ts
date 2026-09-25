import type { NextRequest } from 'next/server';
import { shareRouteResponse } from '../share-bff';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return shareRouteResponse(request, id, '/preview');
}
