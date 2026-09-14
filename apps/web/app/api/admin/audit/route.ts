import type { NextRequest } from 'next/server';
import { adminJson, safeAdminQuery } from '../bff';

const allowed = [
  'page',
  'limit',
  'action',
  'entityType',
  'entityId',
  'actorUserId',
  'from',
  'to',
] as const;

export async function GET(request: NextRequest) {
  return adminJson(request, `/admin/audit${safeAdminQuery(request, allowed)}`);
}
