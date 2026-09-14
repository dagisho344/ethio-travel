import type { NextRequest } from 'next/server';
import { jsonError } from '../../../../../../lib/auth/session';
import {
  managedPath,
  managedResponse,
  type ManagedRouteContext,
} from '../operations-bff';

export async function GET(request: NextRequest, context: ManagedRouteContext) {
  try {
    return managedResponse(request, await managedPath(context, '/dashboard'));
  } catch (error) {
    return jsonError(error);
  }
}
