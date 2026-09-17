import { BffAuthError } from '../../../../../../../../lib/auth/session';
import {
  isManagedUuid,
  managedPath,
  type ManagedRouteContext,
} from '../../../operations-bff';

export type AccommodationRouteContext = {
  params: Promise<{ businessId: string; serviceId: string }>;
};

export async function accommodationPath(
  context: AccommodationRouteContext,
  suffix = '',
): Promise<string> {
  const resolved = await context.params;
  if (!isManagedUuid(resolved.serviceId)) {
    throw new BffAuthError(404, 'Service not found.');
  }
  return managedPath(
    { params: Promise.resolve(resolved) } satisfies ManagedRouteContext,
    `/services/${resolved.serviceId}/accommodation${suffix}`,
  );
}

export function roomPathSuffix(roomTypeId: string, suffix = ''): string {
  if (!isManagedUuid(roomTypeId)) {
    throw new BffAuthError(404, 'Room type not found.');
  }
  return `/rooms/${roomTypeId}${suffix}`;
}
