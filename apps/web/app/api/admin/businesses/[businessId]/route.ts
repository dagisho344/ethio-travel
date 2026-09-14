import type { NextRequest } from 'next/server';
import { adminJson, adminUuid } from '../../bff';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ businessId: string }> },
) {
  const { businessId } = await params;
  return adminJson(
    request,
    `/admin/businesses/${adminUuid(businessId, 'Business')}`,
  );
}
