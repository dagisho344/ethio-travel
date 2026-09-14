import type { NextRequest } from 'next/server';
import { adminJson, safeAdminQuery } from '../../bff';

const query = ['page', 'limit', 'q', 'status', 'regionId'] as const;

export async function GET(request: NextRequest) {
  return adminJson(request, `/admin/cities${safeAdminQuery(request, query)}`);
}
