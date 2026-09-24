import type { NextRequest } from 'next/server';
import { budgetRouteResponse, expenseBody, validUuid } from '../../budget-bff';
import { NextResponse } from 'next/server';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; expenseId: string }> },
) {
  const { id, expenseId } = await params;
  if (!validUuid(expenseId))
    return NextResponse.json(
      { message: 'Invalid planned expense ID.' },
      { status: 400 },
    );
  const body = await expenseBody(request, { partial: true });
  if (body instanceof Response) return body;
  return budgetRouteResponse(request, id, `/expenses/${expenseId}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; expenseId: string }> },
) {
  const { id, expenseId } = await params;
  if (!validUuid(expenseId))
    return NextResponse.json(
      { message: 'Invalid planned expense ID.' },
      { status: 400 },
    );
  return budgetRouteResponse(
    request,
    id,
    `/expenses/${expenseId}`,
    { method: 'DELETE' },
    { noContent: true },
  );
}
