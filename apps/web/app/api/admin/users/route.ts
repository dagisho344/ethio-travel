import type { NextRequest } from 'next/server';
import { adminJson, safeAdminQuery } from '../bff';

const allowed = [
  'page',
  'limit',
  'q',
  'status',
  'role',
  'sort',
  'order',
] as const;

export async function GET(request: NextRequest) {
  return adminJson(request, `/admin/users${safeAdminQuery(request, allowed)}`);
}
