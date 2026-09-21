import type { NextRequest } from 'next/server';
import {
  jsonError,
  managedResponse,
  strictAllowedJsonBody,
  transportPath,
  type TransportRouteContext,
} from '../transport-bff';

const routeKeys = ['originCityId', 'destinationCityId'] as const;

export async function GET(
  request: NextRequest,
  context: TransportRouteContext,
) {
  try {
    return managedResponse(request, await transportPath(context, '/routes'));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(
  request: NextRequest,
  context: TransportRouteContext,
) {
  try {
    return managedResponse(request, await transportPath(context, '/routes'), {
      method: 'POST',
      body: await strictAllowedJsonBody(request, routeKeys),
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    return jsonError(error);
  }
}
