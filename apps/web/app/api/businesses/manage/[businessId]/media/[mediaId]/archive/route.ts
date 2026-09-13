import type { NextRequest } from 'next/server';
import { jsonError } from '../../../../../../../../lib/auth/session';
import { mediaIds, mediaResponse } from '../../bff';

type Context = { params: Promise<{ businessId: string; mediaId: string }> };
export async function POST(request: NextRequest, context: Context) {
  try {
    const { businessId, mediaId } = await mediaIds(context.params);
    return mediaResponse(
      request,
      `/my/businesses/${businessId}/media/${mediaId}/archive`,
      { method: 'POST' },
    );
  } catch (error) {
    return jsonError(error);
  }
}
