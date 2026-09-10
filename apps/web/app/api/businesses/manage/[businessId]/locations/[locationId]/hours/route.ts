import type { NextRequest } from 'next/server';
import { jsonError } from '../../../../../../../../lib/auth/session';
import { locationBody, locationPath, locationResponse } from '../../bff';

type Context = { params: Promise<{ businessId: string; locationId: string }> };
export async function GET(request: NextRequest, context: Context) {
  try {
    const { businessId, locationId } = await locationPath(context.params);
    return locationResponse(
      request,
      `/my/businesses/${businessId}/locations/${locationId}/hours`,
    );
  } catch (error) {
    return jsonError(error);
  }
}
export async function PUT(request: NextRequest, context: Context) {
  try {
    const { businessId, locationId } = await locationPath(context.params);
    return locationResponse(
      request,
      `/my/businesses/${businessId}/locations/${locationId}/hours`,
      { method: 'PUT', body: await locationBody(request, true) },
    );
  } catch (error) {
    return jsonError(error);
  }
}
