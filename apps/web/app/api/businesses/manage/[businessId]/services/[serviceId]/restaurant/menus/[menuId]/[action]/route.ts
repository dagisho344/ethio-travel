import type { NextRequest } from 'next/server';
import {
  BffAuthError,
  jsonError,
  managedResponse,
  menuPathSuffix,
  restaurantPath,
  type RestaurantRouteContext,
} from '../../../restaurant-bff';

type MenuActionContext = RestaurantRouteContext & {
  params: Promise<{
    businessId: string;
    serviceId: string;
    menuId: string;
    action: string;
  }>;
};

export async function POST(request: NextRequest, context: MenuActionContext) {
  try {
    const { menuId, action } = await context.params;
    if (action !== 'activate' && action !== 'deactivate') {
      throw new BffAuthError(404, 'Restaurant menu action not found.');
    }
    return managedResponse(
      request,
      await restaurantPath(context, menuPathSuffix(menuId, `/${action}`)),
      { method: 'POST' },
    );
  } catch (error) {
    return jsonError(error);
  }
}
