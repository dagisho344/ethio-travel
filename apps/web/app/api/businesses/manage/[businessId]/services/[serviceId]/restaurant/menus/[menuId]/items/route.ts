import type { NextRequest } from 'next/server';
import {
  jsonError,
  managedResponse,
  menuPathSuffix,
  restaurantPath,
  strictAllowedJsonBody,
  type RestaurantRouteContext,
} from '../../../restaurant-bff';

type MenuContext = RestaurantRouteContext & {
  params: Promise<{ businessId: string; serviceId: string; menuId: string }>;
};
const itemKeys = [
  'section',
  'name',
  'description',
  'price',
  'currency',
  'sortOrder',
] as const;

export async function GET(request: NextRequest, context: MenuContext) {
  try {
    const { menuId } = await context.params;
    return managedResponse(
      request,
      await restaurantPath(context, menuPathSuffix(menuId, '/items')),
    );
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest, context: MenuContext) {
  try {
    const { menuId } = await context.params;
    return managedResponse(
      request,
      await restaurantPath(context, menuPathSuffix(menuId, '/items')),
      {
        method: 'POST',
        body: await strictAllowedJsonBody(request, itemKeys),
      },
    );
  } catch (error) {
    return jsonError(error);
  }
}
