import type { NextRequest } from 'next/server';
import { adminError, adminJson, adminUuid } from '../../../bff';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ destinationId: string }> },
) {
  try {
    const { destinationId } = await params;
    return adminJson(
      request,
      `/admin/destinations/${adminUuid(destinationId, 'Destination')}/publish`,
      { method: 'POST' },
    );
  } catch (error) {
    return adminError(error);
  }
}
