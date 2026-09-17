import type { NextRequest } from 'next/server';
import {
  itineraryPathSuffix,
  jsonError,
  managedResponse,
  strictAllowedJsonBody,
  tourPath,
  type TourRouteContext,
} from '../../tour-bff';

type ItineraryItemContext = TourRouteContext & {
  params: Promise<{
    businessId: string;
    serviceId: string;
    itemId: string;
  }>;
};
const itineraryKeys = [
  'dayNumber',
  'title',
  'description',
  'sortOrder',
] as const;

export async function PATCH(
  request: NextRequest,
  context: ItineraryItemContext,
) {
  try {
    const { itemId } = await context.params;
    return managedResponse(
      request,
      await tourPath(context, itineraryPathSuffix(itemId)),
      {
        method: 'PATCH',
        body: await strictAllowedJsonBody(request, itineraryKeys),
      },
    );
  } catch (error) {
    return jsonError(error);
  }
}
