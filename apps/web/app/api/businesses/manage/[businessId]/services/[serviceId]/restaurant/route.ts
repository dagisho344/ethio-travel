import type { NextRequest } from 'next/server';
import {
  jsonError,
  managedResponse,
  restaurantPath,
  strictAllowedJsonBodyWithStringArrays,
  type RestaurantRouteContext,
} from './restaurant-bff';

const detailScalarKeys = ['reservationSupported', 'deliverySupported'] as const;
const detailStringArrayKeys = ['cuisineTypes'] as const;

export async function GET(
  request: NextRequest,
  context: RestaurantRouteContext,
) {
  try {
    return managedResponse(request, await restaurantPath(context));
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  context: RestaurantRouteContext,
) {
  try {
    return managedResponse(request, await restaurantPath(context), {
      method: 'PATCH',
      body: await strictAllowedJsonBodyWithStringArrays(
        request,
        detailScalarKeys,
        detailStringArrayKeys,
      ),
    });
  } catch (error) {
    return jsonError(error);
  }
}
