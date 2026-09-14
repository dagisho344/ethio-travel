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
    const query = queryFrom(request, ['page', 'limit', 'status', 'provider']);
    const businessPath = await managedPath(context, '');
    const backendPath =
      businessPath.replace('/my/businesses/', '/businesses/') + '/payments';
    return managedResponse(
      request,
      `${backendPath}${query ? `?${query}` : ''}`,
    );
  } catch (error) {
    return jsonError(error);
  }
}
