import type { NextRequest } from 'next/server';
import { jsonError } from '../../../../../../lib/auth/session';
import { locationBody, locationPath, locationResponse } from './bff';

type Context = { params: Promise<{ businessId: string }> };
export async function GET(request: NextRequest, context: Context) {
  try {
    const { businessId } = await locationPath(context.params);
    return locationResponse(request, `/my/businesses/${businessId}/locations`);
  } catch (error) {
    return jsonError(error);
  }
}
export async function POST(request: NextRequest, context: Context) {
  try {
    const { businessId } = await locationPath(context.params);
    return locationResponse(
      request,
      `/my/businesses/${businessId}/locations`,
      { method: 'POST', body: await locationBody(request) },
      201,
    );
  } catch (error) {
    return jsonError(error);
  }
}
