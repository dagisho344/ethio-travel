import type { NextRequest } from 'next/server';
import { BffAuthError, jsonError } from '../../../../../lib/auth/session';
import { businessRequestBody, businessRouteResponse } from '../bff';

type RouteContext = { params: Promise<{ businessId: string }> };
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

async function managedBusinessPath(context: RouteContext): Promise<string> {
  const { businessId } = await context.params;
  if (!uuidPattern.test(businessId))
    throw new BffAuthError(404, 'Business not found.');
  return `/my/businesses/${businessId}`;
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    return businessRouteResponse(request, await managedBusinessPath(context));
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    return businessRouteResponse(request, await managedBusinessPath(context), {
      method: 'PATCH',
      body: await businessRequestBody(request),
    });
  } catch (error) {
    return jsonError(error);
  }
}
