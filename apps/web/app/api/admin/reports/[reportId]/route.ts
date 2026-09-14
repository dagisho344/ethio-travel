import type { NextRequest } from 'next/server';
import { adminError, adminJson, adminUuid } from '../../bff';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  try {
    const { reportId } = await params;
    return adminJson(
      request,
      `/admin/reports/${adminUuid(reportId, 'Report')}`,
    );
  } catch (error) {
    return adminError(error);
  }
}
