import type { NextRequest } from 'next/server';
import { jsonError } from '../../../../../../../../../../lib/auth/session';
import {
  managedResponse,
  strictAllowedJsonBody,
} from '../../../../../operations-bff';
import {
  accommodationPath,
  roomPathSuffix,
  type AccommodationRouteContext,
} from '../../accommodation-bff';

type RoomContext = AccommodationRouteContext & {
  params: Promise<{
    businessId: string;
    serviceId: string;
    roomTypeId: string;
  }>;
};
const updateRoomKeys = [
  'name',
  'description',
  'capacity',
  'basePrice',
  'currency',
  'quantity',
] as const;

export async function PATCH(request: NextRequest, context: RoomContext) {
  try {
    const { roomTypeId } = await context.params;
    return managedResponse(
      request,
      await accommodationPath(context, roomPathSuffix(roomTypeId)),
      {
        method: 'PATCH',
        body: await strictAllowedJsonBody(request, updateRoomKeys),
      },
    );
  } catch (error) {
    return jsonError(error);
  }
}
