import type { NextRequest } from 'next/server';
import { BffAuthError, jsonError } from '../../../../../../../lib/auth/session';
import {
  allowedJsonBody,
  managedPath,
  managedResponse,
} from '../../operations-bff';

const serviceKeys = [
  'categoryId',
  'name',
  'slug',
  'shortDescription',
  'description',
  'price',
  'currency',
  'pricingModel',
  'durationMinutes',
  'minGuests',
  'maxGuests',
  'locationMode',
  'address',
  'latitude',
  'longitude',
] as const;

async function path(
  params: Promise<{ businessId: string; serviceId: string }>,
) {
  const resolved = await params;
  if (!/^[0-9a-f-]{36}$/i.test(resolved.serviceId))
    throw new BffAuthError(404, 'Service not found.');
  return managedPath(
    { params: Promise.resolve(resolved) },
    `/services/${resolved.serviceId}`,
  );
}
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; serviceId: string }> },
) {
  try {
    return managedResponse(request, await path(params));
  } catch (error) {
    return jsonError(error);
  }
}
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; serviceId: string }> },
) {
  try {
    return managedResponse(request, await path(params), {
      method: 'PATCH',
      body: await allowedJsonBody(request, serviceKeys),
    });
  } catch (error) {
    return jsonError(error);
  }
}
