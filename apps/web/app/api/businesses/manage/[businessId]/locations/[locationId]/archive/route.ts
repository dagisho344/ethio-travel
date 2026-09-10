import type { NextRequest } from 'next/server';
import { jsonError } from '../../../../../../../../lib/auth/session';
import { locationPath, locationResponse } from '../../bff';

type Context = { params: Promise<{ businessId: string; locationId: string }> };
export async function POST(request: NextRequest, context: Context) {
  try {
    const { businessId, locationId } = await locationPath(context.params);
    return locationResponse(
      request,
      `/my/businesses/${businessId}/locations/${locationId}/archive`,
      { method: 'POST' },
    );
  } catch (error) {
    return jsonError(error);
  }
}
