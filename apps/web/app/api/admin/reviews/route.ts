import type { NextRequest } from 'next/server';
import { adminJson, safeAdminQuery } from '../bff';

const query = [
  'page',
  'limit',
  'status',
  'targetType',
  'rating',
  'userId',
  'sort',
] as const;

export async function GET(request: NextRequest) {
  return adminJson(request, `/admin/reviews${safeAdminQuery(request, query)}`);
}
