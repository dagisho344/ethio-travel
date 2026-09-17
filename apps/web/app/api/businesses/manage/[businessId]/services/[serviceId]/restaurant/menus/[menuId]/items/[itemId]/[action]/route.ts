import type { NextRequest } from 'next/server';
import {
  BffAuthError,
  jsonError,
  managedResponse,
  menuItemPathSuffix,
  restaurantPath,
  type RestaurantRouteContext,
} from '../../../../../restaurant-bff';

type MenuItemActionContext = RestaurantRouteContext & {
  params: Promise<{
    businessId: string;
    serviceId: string;
    menuId: string;
    itemId: string;
    action: string;
  }>;
};

export async function POST(
  request: NextRequest,
  context: MenuItemActionContext,
) {
  try {
    const { menuId, itemId, action } = await context.params;
    if (action !== 'available' && action !== 'unavailable') {
      throw new BffAuthError(404, 'Restaurant menu item action not found.');
    }
    return managedResponse(
      request,
      await restaurantPath(
        context,
        menuItemPathSuffix(menuId, itemId, `/${action}`),
      ),
      { method: 'POST' },
    );
  } catch (error) {
    return jsonError(error);
  }
}
