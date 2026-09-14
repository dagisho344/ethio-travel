import type { NextRequest } from 'next/server';
import { adminAllowedBody, adminJson, safeAdminQuery } from '../../bff';

const query = ['page', 'limit', 'q', 'isActive'] as const;
const fields = [
  'code',
  'name',
  'description',
  'isActive',
  'sortOrder',
] as const;

export async function GET(request: NextRequest) {
  return adminJson(
    request,
    `/admin/service-categories${safeAdminQuery(request, query)}`,
  );
}

export async function POST(request: NextRequest) {
  return adminJson(request, '/admin/service-categories', {
    body: await adminAllowedBody(request, fields),
    method: 'POST',
  });
}
