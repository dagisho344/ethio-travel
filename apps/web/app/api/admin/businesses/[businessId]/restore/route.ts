import type { NextRequest } from 'next/server';
import {
  adminError,
  adminJson,
  adminReasonBody,
  adminUuid,
} from '../../../bff';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> },
) {
  try {
    const { businessId } = await params;
    return adminJson(
      request,
      `/admin/businesses/${adminUuid(businessId, 'Business')}/restore`,
      { body: await adminReasonBody(request), method: 'POST' },
    );
  } catch (error) {
    return adminError(error);
  }
}
