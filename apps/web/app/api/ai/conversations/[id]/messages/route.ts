import type { NextRequest } from 'next/server';
import { aiRouteResponse, requestBody } from '../../../bff';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return aiRouteResponse(request, `/ai/conversations/${id}/messages`, {
    method: 'POST',
    body: await requestBody(request),
  });
}
