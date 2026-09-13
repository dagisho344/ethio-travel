import type { NextRequest } from 'next/server';
import { jsonError } from '../../../../../../../lib/auth/session';
import { mediaIds, mediaJsonBody, mediaResponse } from '../bff';

type Context = { params: Promise<{ businessId: string }> };
export async function POST(request: NextRequest, context: Context) {
  try {
    const { businessId } = await mediaIds(context.params);
    return mediaResponse(
      request,
      `/my/businesses/${businessId}/media/reorder`,
      { method: 'POST', body: await mediaJsonBody(request, true) },
    );
  } catch (error) {
    return jsonError(error);
  }
}
