import {
  BffAuthError,
  jsonError,
} from '../../../../../../../../lib/auth/session';
import {
  isManagedUuid,
  managedPath,
  managedResponse,
  strictAllowedJsonBody,
  strictAllowedJsonBodyWithStringArrays,
  type ManagedRouteContext,
} from '../../../operations-bff';

export {
  BffAuthError,
  jsonError,
  managedResponse,
  strictAllowedJsonBody,
  strictAllowedJsonBodyWithStringArrays,
};

export type RestaurantRouteContext = {
  params: Promise<{ businessId: string; serviceId: string }>;
};

export async function restaurantPath(
  context: RestaurantRouteContext,
  suffix = '',
): Promise<string> {
  const resolved = await context.params;
  if (!isManagedUuid(resolved.serviceId)) {
    throw new BffAuthError(404, 'Service not found.');
  }
  return managedPath(
    { params: Promise.resolve(resolved) } satisfies ManagedRouteContext,
    `/services/${resolved.serviceId}/restaurant${suffix}`,
  );
}

export function menuPathSuffix(menuId: string, suffix = ''): string {
  if (!isManagedUuid(menuId)) {
    throw new BffAuthError(404, 'Restaurant menu not found.');
  }
  return `/menus/${menuId}${suffix}`;
}

export function menuItemPathSuffix(
  menuId: string,
  itemId: string,
  suffix = '',
): string {
  if (!isManagedUuid(menuId)) {
    throw new BffAuthError(404, 'Restaurant menu not found.');
  }
  if (!isManagedUuid(itemId)) {
    throw new BffAuthError(404, 'Restaurant menu item not found.');
  }
  return `/menus/${menuId}/items/${itemId}${suffix}`;
}
