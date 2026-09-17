import type { NextRequest } from 'next/server';
import {
  jsonError,
  managedResponse,
  menuItemPathSuffix,
  restaurantPath,
  strictAllowedJsonBody,
  type RestaurantRouteContext,
} from '../../../../restaurant-bff';

type MenuItemContext = RestaurantRouteContext & {
  params: Promise<{
    businessId: string;
    serviceId: string;
    menuId: string;
    itemId: string;
  }>;
};
const itemKeys = [
  'section',
  'name',
  'description',
  'price',
  'currency',
  'sortOrder',
] as const;

export async function PATCH(request: NextRequest, context: MenuItemContext) {
  try {
    const { menuId, itemId } = await context.params;
    return managedResponse(
      request,
      await restaurantPath(context, menuItemPathSuffix(menuId, itemId)),
      {
        method: 'PATCH',
        body: await strictAllowedJsonBody(request, itemKeys),
      },
    );
  } catch (error) {
    return jsonError(error);
  }
}
