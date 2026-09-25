import type { NextRequest } from 'next/server';
import { shareRouteResponse } from '../share-bff';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return shareRouteResponse(
    request,
    id,
    '/revoke',
    { method: 'POST' },
    { noContent: true },
  );
}
