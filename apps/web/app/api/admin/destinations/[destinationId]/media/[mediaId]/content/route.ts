import type { NextRequest } from 'next/server';
import { adminError } from '../../../../../bff';
import { destinationMediaContent, destinationMediaIds } from '../../bff';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ destinationId: string; mediaId: string }> },
) {
  try {
    const value = await params;
    const { destinationId, mediaId } = destinationMediaIds(
      value.destinationId,
      value.mediaId,
    );
    return destinationMediaContent(
      `/admin/destinations/${destinationId}/media/${mediaId}/content`,
    );
  } catch (error) {
    return adminError(error);
  }
}
