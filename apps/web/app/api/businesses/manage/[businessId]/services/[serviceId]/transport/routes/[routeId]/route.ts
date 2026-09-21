import type { NextRequest } from 'next/server';
import {
  jsonError,
  managedResponse,
  routePathSuffix,
  strictAllowedJsonBody,
  transportPath,
  type TransportRouteContext,
} from '../../transport-bff';

type RouteContext = TransportRouteContext & {
  params: Promise<{ businessId: string; serviceId: string; routeId: string }>;
};
const routeKeys = ['originCityId', 'destinationCityId'] as const;

export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { routeId } = await context.params;
    return managedResponse(
      request,
      await transportPath(context, routePathSuffix(routeId)),
      {
        method: 'PATCH',
        body: await strictAllowedJsonBody(request, routeKeys),
        headers: { 'content-type': 'application/json' },
      },
    );
  } catch (error) {
    return jsonError(error);
  }
}
