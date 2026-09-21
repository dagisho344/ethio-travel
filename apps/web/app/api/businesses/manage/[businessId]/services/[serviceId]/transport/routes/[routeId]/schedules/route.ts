import type { NextRequest } from 'next/server';
import {
  jsonError,
  managedResponse,
  routePathSuffix,
  strictAllowedJsonBody,
  transportPath,
  type TransportRouteContext,
} from '../../../transport-bff';

type RouteContext = TransportRouteContext & {
  params: Promise<{ businessId: string; serviceId: string; routeId: string }>;
};
const scheduleKeys = [
  'departureAt',
  'arrivalAt',
  'fare',
  'currency',
  'capacity',
] as const;

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { routeId } = await context.params;
    return managedResponse(
      request,
      await transportPath(context, routePathSuffix(routeId, '/schedules')),
    );
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { routeId } = await context.params;
    return managedResponse(
      request,
      await transportPath(context, routePathSuffix(routeId, '/schedules')),
      {
        method: 'POST',
        body: await strictAllowedJsonBody(request, scheduleKeys),
        headers: { 'content-type': 'application/json' },
      },
    );
  } catch (error) {
    return jsonError(error);
  }
}
