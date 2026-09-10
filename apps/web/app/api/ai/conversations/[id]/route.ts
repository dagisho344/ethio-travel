import type { NextRequest } from 'next/server';
import { aiRouteResponse } from '../../bff';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return aiRouteResponse(request, `/ai/conversations/${id}`);
}
