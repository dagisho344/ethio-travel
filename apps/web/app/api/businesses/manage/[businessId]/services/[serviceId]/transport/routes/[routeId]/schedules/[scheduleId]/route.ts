import type { NextRequest } from 'next/server';
import {
  jsonError,
  managedResponse,
  schedulePathSuffix,
  strictAllowedJsonBody,
  transportPath,
  type TransportRouteContext,
} from '../../../../transport-bff';

type ScheduleContext = TransportRouteContext & {
  params: Promise<{
    businessId: string;
    serviceId: string;
    routeId: string;
    scheduleId: string;
  }>;
};
const scheduleKeys = [
  'departureAt',
  'arrivalAt',
  'fare',
  'currency',
  'capacity',
] as const;

export async function PATCH(request: NextRequest, context: ScheduleContext) {
  try {
    const { routeId, scheduleId } = await context.params;
    return managedResponse(
      request,
      await transportPath(context, schedulePathSuffix(routeId, scheduleId)),
      {
        method: 'PATCH',
        body: await strictAllowedJsonBody(request, scheduleKeys),
        headers: { 'content-type': 'application/json' },
      },
    );
  } catch (error) {
    return jsonError(error);
  }
}
