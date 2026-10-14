import type { NextRequest } from 'next/server';
import { adminError, adminJson } from '../../../../bff';
import { destinationMediaIds, destinationMediaMetadataBody } from '../bff';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ destinationId: string; mediaId: string }> },
) {
  try {
    const { destinationId, mediaId } = destinationMediaIds(
      (await params).destinationId,
      (await params).mediaId,
    );
    return adminJson(
      request,
      `/admin/destinations/${destinationId}/media/${mediaId}`,
      { method: 'PATCH', body: await destinationMediaMetadataBody(request) },
    );
  } catch (error) {
    return adminError(error);
  }
}
