import type { NextRequest } from 'next/server';
import {
  adminError,
  adminJson,
  adminResolutionBody,
  adminUuid,
} from '../../../bff';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ reportId: string }> },
) {
  try {
    const { reportId } = await params;
    return adminJson(
      request,
      `/admin/reports/${adminUuid(reportId, 'Report')}/dismiss`,
      { body: await adminResolutionBody(request), method: 'POST' },
    );
  } catch (error) {
    return adminError(error);
  }
}
