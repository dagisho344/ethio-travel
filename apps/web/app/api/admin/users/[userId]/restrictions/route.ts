import type { NextRequest } from 'next/server';
import {
  adminError,
  adminJson,
  adminRestrictBody,
  adminUuid,
} from '../../../bff';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId } = await params;
    return adminJson(
      request,
      `/admin/users/${adminUuid(userId, 'User')}/restrictions`,
    );
  } catch (error) {
    return adminError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId } = await params;
    const validatedId = adminUuid(userId, 'User');
    return adminJson(request, `/admin/users/${validatedId}/restrictions`, {
      method: 'POST',
      body: await adminRestrictBody(request),
    });
  } catch (error) {
    return adminError(error);
  }
}
