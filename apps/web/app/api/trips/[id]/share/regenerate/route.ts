import type { NextRequest } from 'next/server';
import { expirationBody, shareRouteResponse } from '../share-bff';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await expirationBody(request, { required: false });
  if (body instanceof Response) return body;
  return shareRouteResponse(request, id, '/regenerate', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}
