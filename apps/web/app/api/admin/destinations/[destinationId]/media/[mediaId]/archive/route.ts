import type { NextRequest } from 'next/server';
import { adminError, adminJson } from '../../../../../bff';
import { destinationMediaIds, destinationMediaNoBody } from '../../bff';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ destinationId: string; mediaId: string }> },
) {
  try {
    const { destinationId, mediaId } = destinationMediaIds(
      (await params).destinationId,
      (await params).mediaId,
    );
    await destinationMediaNoBody(request);
    return adminJson(
      request,
      `/admin/destinations/${destinationId}/media/${mediaId}/archive`,
      { method: 'POST' },
    );
  } catch (error) {
    return adminError(error);
  }
}
