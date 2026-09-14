import type { NextRequest } from 'next/server';
import {
  adminError,
  adminJson,
  adminModerationNoteBody,
  adminUuid,
} from '../../../bff';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reviewId: string }> },
) {
  try {
    const { reviewId } = await params;
    return adminJson(
      request,
      `/admin/reviews/${adminUuid(reviewId, 'Review')}/hide`,
      { body: await adminModerationNoteBody(request), method: 'POST' },
    );
  } catch (error) {
    return adminError(error);
  }
}
