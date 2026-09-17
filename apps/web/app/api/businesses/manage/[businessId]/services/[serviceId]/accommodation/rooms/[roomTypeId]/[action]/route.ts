import type { NextRequest } from 'next/server';
import {
  BffAuthError,
  jsonError,
} from '../../../../../../../../../../../lib/auth/session';
import { managedResponse } from '../../../../../../operations-bff';
import {
  accommodationPath,
  roomPathSuffix,
  type AccommodationRouteContext,
} from '../../../accommodation-bff';

type RoomActionContext = AccommodationRouteContext & {
  params: Promise<{
    businessId: string;
    serviceId: string;
    roomTypeId: string;
    action: string;
  }>;
};

export async function POST(request: NextRequest, context: RoomActionContext) {
  try {
    const { roomTypeId, action } = await context.params;
    if (action !== 'activate' && action !== 'deactivate') {
      throw new BffAuthError(404, 'Room type action not found.');
    }
    return managedResponse(
      request,
      await accommodationPath(
        context,
        roomPathSuffix(roomTypeId, `/${action}`),
      ),
      { method: 'POST' },
    );
  } catch (error) {
    return jsonError(error);
  }
}
