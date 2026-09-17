import type { NextRequest } from 'next/server';
import {
  jsonError,
  managedResponse,
  restaurantPath,
  strictAllowedJsonBody,
  type RestaurantRouteContext,
} from '../restaurant-bff';

const menuKeys = ['name', 'description', 'sortOrder'] as const;

export async function GET(
  request: NextRequest,
  context: RestaurantRouteContext,
) {
  try {
    return managedResponse(request, await restaurantPath(context, '/menus'));
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(
  request: NextRequest,
  context: RestaurantRouteContext,
) {
  try {
    return managedResponse(request, await restaurantPath(context, '/menus'), {
      method: 'POST',
      body: await strictAllowedJsonBody(request, menuKeys),
    });
  } catch (error) {
    return jsonError(error);
  }
}
