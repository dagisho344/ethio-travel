import type { NextRequest } from 'next/server';
import { aiRouteResponse } from '../../../../../../ai/bff';

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string; suggestionId: string }> },
) {
  const { id, suggestionId } = await context.params;
  return aiRouteResponse(
    request,
    `/trips/${id}/ai/suggestions/${suggestionId}/apply`,
    { method: 'POST' },
  );
}
