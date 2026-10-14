import type { NextRequest } from 'next/server';
import { adminError, adminJson } from '../../../../bff';
import { destinationMediaIds, destinationMediaReorderBody } from '../bff';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ destinationId: string }> },
) {
  try {
    const { destinationId } = destinationMediaIds((await params).destinationId);
    return adminJson(
      request,
      `/admin/destinations/${destinationId}/media/reorder`,
      { method: 'POST', body: await destinationMediaReorderBody(request) },
    );
  } catch (error) {
    return adminError(error);
  }
}
