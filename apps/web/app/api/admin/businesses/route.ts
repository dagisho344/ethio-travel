import type { NextRequest } from 'next/server';
import { adminJson, safeAdminQuery } from '../bff';

const allowed = [
  'page',
  'limit',
  'q',
  'status',
  'verificationSummary',
  'categoryId',
  'cityId',
] as const;

export async function GET(request: NextRequest) {
  return adminJson(
    request,
    `/admin/businesses${safeAdminQuery(request, allowed)}`,
  );
}
