import type { NextRequest } from 'next/server';
import {
  BffAuthError,
  jsonError,
} from '../../../../../../../../lib/auth/session';
import {
  allowedJsonBody,
  managedPath,
  managedResponse,
} from '../../../operations-bff';

async function write(
  request: NextRequest,
  params: Promise<{ businessId: string; reviewId: string }>,
) {
  try {
    const resolved = await params;
    if (!/^[0-9a-f-]{36}$/i.test(resolved.reviewId)) {
      throw new BffAuthError(404, 'Review not found.');
    }
    return managedResponse(
      request,
      await managedPath(
        { params: Promise.resolve(resolved) },
        `/reviews/${resolved.reviewId}/response`,
      ),
      {
        method: request.method,
        body: await allowedJsonBody(request, ['body']),
      },
    );
  } catch (error) {
    return jsonError(error);
  }
}

export function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; reviewId: string }> },
) {
  return write(request, context.params);
}
export function PATCH(
  request: NextRequest,
  context: { params: Promise<{ businessId: string; reviewId: string }> },
) {
  return write(request, context.params);
}
