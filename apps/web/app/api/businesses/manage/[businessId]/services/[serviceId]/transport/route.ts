import type { NextRequest } from 'next/server';
import {
  jsonError,
  managedResponse,
  strictAllowedJsonBody,
  transportPath,
  type TransportRouteContext,
} from './transport-bff';

const detailKeys = ['mode', 'operatorName'] as const;

export async function GET(
  request: NextRequest,
  context: TransportRouteContext,
) {
  try {
    return managedResponse(request, await transportPath(context));
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: TransportRouteContext,
) {
  try {
    return managedResponse(request, await transportPath(context), {
      method: 'PATCH',
      body: await strictAllowedJsonBody(request, detailKeys),
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    return jsonError(error);
  }
}
