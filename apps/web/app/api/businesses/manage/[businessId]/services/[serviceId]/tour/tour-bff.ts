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

export type TourRouteContext = {
  params: Promise<{ businessId: string; serviceId: string }>;
};

export async function tourPath(
  context: TourRouteContext,
  suffix = '',
): Promise<string> {
  const resolved = await context.params;
  if (!isManagedUuid(resolved.serviceId)) {
    throw new BffAuthError(404, 'Service not found.');
  }
  return managedPath(
    { params: Promise.resolve(resolved) } satisfies ManagedRouteContext,
    `/services/${resolved.serviceId}/tour${suffix}`,
  );
}

export function itineraryPathSuffix(itemId: string): string {
  if (!isManagedUuid(itemId)) {
    throw new BffAuthError(404, 'Tour itinerary item not found.');
  }
  return `/itinerary/${itemId}`;
}
