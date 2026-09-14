import type { NextRequest } from 'next/server';
import {
  adminAllowedBody,
  adminError,
  adminJson,
  adminUuid,
} from '../../../bff';

const fields = [
  'code',
  'name',
  'description',
  'isActive',
  'sortOrder',
] as const;

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ categoryId: string }> },
) {
  try {
    const { categoryId } = await params;
    return adminJson(
      request,
      `/admin/service-categories/${adminUuid(categoryId, 'Category')}`,
      { body: await adminAllowedBody(request, fields), method: 'PATCH' },
    );
  } catch (error) {
    return adminError(error);
  }
}
