import type { NextRequest } from 'next/server';
import { adminAllowedBody, adminError, adminJson, adminUuid } from '../../bff';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  return adminJson(request, `/admin/users/${adminUuid(userId, 'User')}`);
}

const updateFields = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'roles',
] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  try {
    const { userId } = await params;
    return adminJson(request, `/admin/users/${adminUuid(userId, 'User')}`, {
      method: 'PATCH',
      body: await adminAllowedBody(request, updateFields, true),
    });
  } catch (error) {
    return adminError(error);
  }
}
