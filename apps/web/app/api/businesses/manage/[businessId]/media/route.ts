import type { NextRequest } from 'next/server';
import { jsonError } from '../../../../../../lib/auth/session';
import { mediaIds, mediaResponse, multipartMediaResponse } from './bff';

type Context = { params: Promise<{ businessId: string }> };
export async function GET(request: NextRequest, context: Context) {
  try {
    const { businessId } = await mediaIds(context.params);
    return mediaResponse(request, `/my/businesses/${businessId}/media`);
  } catch (error) {
    return jsonError(error);
  }
}
export async function POST(request: NextRequest, context: Context) {
  try {
    const { businessId } = await mediaIds(context.params);
    return multipartMediaResponse(
      request,
      `/my/businesses/${businessId}/media/uploads`,
    );
  } catch (error) {
    return jsonError(error);
  }
}
