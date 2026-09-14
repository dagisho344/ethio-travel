import type { NextRequest } from 'next/server';
import { jsonError } from '../../../../../../lib/auth/session';
import {
  managedPath,
  managedResponse,
  queryFrom,
  type ManagedRouteContext,
} from '../operations-bff';

export async function GET(request: NextRequest, context: ManagedRouteContext) {
  try {
    const query = queryFrom(request, ['page', 'limit', 'status']);
    return managedResponse(
      request,
      `${await managedPath(context, '/reviews')}${query ? `?${query}` : ''}`,
    );
  } catch (error) {
    return jsonError(error);
  }
}
