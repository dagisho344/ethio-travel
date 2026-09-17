import type { NextRequest } from 'next/server';
import {
  jsonError,
  managedResponse,
  menuPathSuffix,
  restaurantPath,
  strictAllowedJsonBody,
  type RestaurantRouteContext,
} from '../../restaurant-bff';

type MenuContext = RestaurantRouteContext & {
  params: Promise<{ businessId: string; serviceId: string; menuId: string }>;
};
const menuKeys = ['name', 'description', 'sortOrder'] as const;

export async function PATCH(request: NextRequest, context: MenuContext) {
  try {
    const { menuId } = await context.params;
    return managedResponse(
      request,
      await restaurantPath(context, menuPathSuffix(menuId)),
      {
        method: 'PATCH',
        body: await strictAllowedJsonBody(request, menuKeys),
      },
    );
  } catch (error) {
    return jsonError(error);
  }
}
