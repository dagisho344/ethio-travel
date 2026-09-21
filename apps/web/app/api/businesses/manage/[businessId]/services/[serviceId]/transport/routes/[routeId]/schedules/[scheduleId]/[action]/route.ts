import type { NextRequest } from 'next/server';
import {
  BffAuthError,
  jsonError,
  managedResponse,
  schedulePathSuffix,
  transportPath,
  type TransportRouteContext,
} from '../../../../../transport-bff';

type ActionContext = TransportRouteContext & {
  params: Promise<{
    businessId: string;
    serviceId: string;
    routeId: string;
    scheduleId: string;
    action: string;
  }>;
};

export async function POST(request: NextRequest, context: ActionContext) {
  try {
    const { routeId, scheduleId, action } = await context.params;
    if (action !== 'activate' && action !== 'deactivate') {
      throw new BffAuthError(404, 'Transport schedule action not found.');
    }
    return managedResponse(
      request,
      await transportPath(
        context,
        schedulePathSuffix(routeId, scheduleId, `/${action}`),
      ),
      { method: 'POST' },
    );
  } catch (error) {
    return jsonError(error);
  }
}
