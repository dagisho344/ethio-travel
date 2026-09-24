import type { NextRequest } from 'next/server';
import { budgetRouteResponse, expenseBody } from '../budget-bff';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await expenseBody(request, { partial: false });
  if (body instanceof Response) return body;
  return budgetRouteResponse(
    request,
    id,
    '/expenses',
    {
      method: 'POST',
      body: JSON.stringify(body),
    },
    { status: 201 },
  );
}
