import type { NextRequest } from 'next/server';
import {
  BffAuthError,
  jsonError,
} from '../../../../../../../../lib/auth/session';
import { managedPath, managedResponse } from '../../../operations-bff';
const actions = new Set(['publish', 'unpublish', 'archive']);
export async function POST(
  request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ businessId: string; serviceId: string; action: string }>;
  },
) {
  try {
    const resolved = await params;
    if (
      !/^[0-9a-f-]{36}$/i.test(resolved.serviceId) ||
      !actions.has(resolved.action)
    )
      throw new BffAuthError(404, 'Service action not found.');
    return managedResponse(
      request,
      await managedPath(
        { params: Promise.resolve(resolved) },
        `/services/${resolved.serviceId}/${resolved.action}`,
      ),
      { method: 'POST' },
    );
  } catch (error) {
    return jsonError(error);
  }
}
