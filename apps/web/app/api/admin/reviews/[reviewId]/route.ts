import type { NextRequest } from 'next/server';
import { adminError, adminJson, adminUuid } from '../../bff';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> },
) {
  try {
    const { reviewId } = await params;
    return adminJson(
      request,
      `/admin/reviews/${adminUuid(reviewId, 'Review')}`,
    );
  } catch (error) {
    return adminError(error);
  }
}
