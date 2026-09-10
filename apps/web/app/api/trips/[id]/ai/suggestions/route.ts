import type { NextRequest } from 'next/server';
import { aiRouteResponse, requestBody } from '../../../../ai/bff';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  return aiRouteResponse(request, `/trips/${id}/ai/suggestions`, {
    method: 'POST',
    body: await requestBody(request),
  });
}
