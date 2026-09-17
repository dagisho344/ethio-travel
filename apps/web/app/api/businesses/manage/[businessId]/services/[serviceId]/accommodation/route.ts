import type { NextRequest } from 'next/server';
import { jsonError } from '../../../../../../../../lib/auth/session';
import {
  managedResponse,
  strictAllowedJsonBody,
} from '../../../operations-bff';
import {
  accommodationPath,
  type AccommodationRouteContext,
} from './accommodation-bff';

const detailKeys = ['starClass', 'checkInTime', 'checkOutTime'] as const;

export async function GET(
  request: NextRequest,
  context: AccommodationRouteContext,
) {
  try {
    return managedResponse(request, await accommodationPath(context));
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: AccommodationRouteContext,
) {
  try {
    return managedResponse(request, await accommodationPath(context), {
      method: 'PATCH',
      body: await strictAllowedJsonBody(request, detailKeys),
    });
  } catch (error) {
    return jsonError(error);
  }
}
