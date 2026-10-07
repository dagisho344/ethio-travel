import type { NextRequest } from 'next/server';
import {
  adminError,
  adminJson,
  adminLiftRestrictionBody,
  adminRestrictionCapability,
  adminUuid,
} from '../../../../../bff';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string; capability: string }> },
) {
  try {
    const { userId, capability } = await params;
    const validatedId = adminUuid(userId, 'User');
    const validatedCapability = adminRestrictionCapability(capability);
    return adminJson(
      request,
      `/admin/users/${validatedId}/restrictions/${validatedCapability}/lift`,
      { method: 'POST', body: await adminLiftRestrictionBody(request) },
    );
  } catch (error) {
    return adminError(error);
  }
}
