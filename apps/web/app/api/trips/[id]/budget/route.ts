import type { NextRequest } from 'next/server';
import { budgetBody, budgetRouteResponse } from './budget-bff';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return budgetRouteResponse(request, id);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await budgetBody(request);
  if (body instanceof Response) return body;
  return budgetRouteResponse(request, id, '', {
    method: 'PUT',
    body: JSON.stringify(body),
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return budgetRouteResponse(
    request,
    id,
    '',
    { method: 'DELETE' },
    { noContent: true },
  );
}
