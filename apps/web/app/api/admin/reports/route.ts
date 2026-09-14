import type { NextRequest } from 'next/server';
import { adminJson, safeAdminQuery } from '../bff';

const query = [
  'page',
  'limit',
  'q',
  'status',
  'targetType',
  'reporterUserId',
  'from',
  'to',
] as const;

export async function GET(request: NextRequest) {
  return adminJson(request, `/admin/reports${safeAdminQuery(request, query)}`);
}
