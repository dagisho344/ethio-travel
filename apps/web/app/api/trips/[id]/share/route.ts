import type { NextRequest } from 'next/server';
import { expirationBody, shareRouteResponse } from './share-bff';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return shareRouteResponse(request, id);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await expirationBody(request, { required: false });
  if (body instanceof Response) return body;
  return shareRouteResponse(
    request,
    id,
    '',
    { method: 'POST', body: JSON.stringify(body) },
    { status: 201 },
  );
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await expirationBody(request, { required: true });
  if (body instanceof Response) return body;
  return shareRouteResponse(request, id, '', {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}
