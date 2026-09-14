import type { NextRequest } from 'next/server';
import { jsonError } from '../../../../../../lib/auth/session';
import {
  allowedJsonBody,
  managedPath,
  managedResponse,
  queryFrom,
  type ManagedRouteContext,
} from '../operations-bff';

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

export async function GET(request: NextRequest, context: ManagedRouteContext) {
  try {
    const query = queryFrom(request, ['page', 'limit', 'q']);
    return managedResponse(
      request,
      `${await managedPath(context, '/services')}${query ? `?${query}` : ''}`,
    );
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: NextRequest, context: ManagedRouteContext) {
  try {
    return managedResponse(request, await managedPath(context, '/services'), {
      method: 'POST',
      body: await allowedJsonBody(request, serviceKeys),
    });
  } catch (error) {
    return jsonError(error);
  }
}
