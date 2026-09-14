import type { NextRequest } from 'next/server';
import { adminJson, adminUuid } from '../../bff';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> },
) {
  const { userId } = await params;
  return adminJson(request, `/admin/users/${adminUuid(userId, 'User')}`);
}
