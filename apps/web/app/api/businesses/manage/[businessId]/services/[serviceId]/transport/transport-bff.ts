import {
  BffAuthError,
  jsonError,
} from '../../../../../../../../lib/auth/session';
import {
  isManagedUuid,
  managedPath,
  managedResponse,
  strictAllowedJsonBody,
  type ManagedRouteContext,
} from '../../../operations-bff';

export { BffAuthError, jsonError, managedResponse, strictAllowedJsonBody };

export type TransportRouteContext = {
  params: Promise<{ businessId: string; serviceId: string }>;
};

export async function transportPath(
  context: TransportRouteContext,
  suffix = '',
): Promise<string> {
  const resolved = await context.params;
  if (!isManagedUuid(resolved.serviceId)) {
    throw new BffAuthError(404, 'Service not found.');
  }
  return managedPath(
    { params: Promise.resolve(resolved) } satisfies ManagedRouteContext,
    `/services/${resolved.serviceId}/transport${suffix}`,
  );
}

export function routePathSuffix(routeId: string, suffix = ''): string {
  if (!isManagedUuid(routeId)) {
    throw new BffAuthError(404, 'Transport route not found.');
  }
  return `/routes/${routeId}${suffix}`;
}

export function schedulePathSuffix(
  routeId: string,
  scheduleId: string,
  suffix = '',
): string {
  if (!isManagedUuid(routeId)) {
    throw new BffAuthError(404, 'Transport route not found.');
  }
  if (!isManagedUuid(scheduleId)) {
    throw new BffAuthError(404, 'Transport schedule not found.');
  }
  return `/routes/${routeId}/schedules/${scheduleId}${suffix}`;
}
