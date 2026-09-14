import type { NextRequest } from 'next/server';
import { jsonError } from '../../../../../../../lib/auth/session';
import { BffAuthError } from '../../../../../../../lib/auth/session';
import { managedPath, managedResponse } from '../../operations-bff';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string; travelerId: string }> },
) {
  try {
    const resolved = await params;
    if (!/^[0-9a-f-]{36}$/i.test(resolved.travelerId)) {
      throw new BffAuthError(404, 'Customer not found.');
    }
    return managedResponse(
      request,
      await managedPath(
        { params: Promise.resolve(resolved) },
        `/customers/${resolved.travelerId}`,
      ),
    );
  } catch (error) {
    return jsonError(error);
  }
}
