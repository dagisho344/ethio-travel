import type { NextRequest } from 'next/server';
import { jsonError } from '../../../../../../../../../lib/auth/session';
import {
  managedResponse,
  strictAllowedJsonBody,
} from '../../../../operations-bff';
import {
  accommodationPath,
  type AccommodationRouteContext,
} from '../accommodation-bff';

const createRoomKeys = [
  'name',
  'description',
  'capacity',
  'basePrice',
  'currency',
  'quantity',
] as const;

export async function GET(
  request: NextRequest,
  context: AccommodationRouteContext,
) {
  try {
    return managedResponse(request, await accommodationPath(context, '/rooms'));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(
  request: NextRequest,
  context: AccommodationRouteContext,
) {
  try {
    return managedResponse(
      request,
      await accommodationPath(context, '/rooms'),
      {
        method: 'POST',
        body: await strictAllowedJsonBody(request, createRoomKeys),
      },
    );
  } catch (error) {
    return jsonError(error);
  }
}
