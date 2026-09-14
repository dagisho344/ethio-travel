import type { NextRequest } from 'next/server';
import {
  adminError,
  adminJson,
  adminReasonBody,
  adminUuid,
} from '../../../bff';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId } = await params;
    return adminJson(
      request,
      `/admin/users/${adminUuid(userId, 'User')}/restore`,
      {
        body: await adminReasonBody(request),
        method: 'POST',
      },
    );
  } catch (error) {
    return adminError(error);
  }
}
