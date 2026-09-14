import type { NextRequest } from 'next/server';
import { adminAllowedBody, adminJson, safeAdminQuery } from '../bff';

const query = ['page', 'limit', 'q', 'status', 'cityId'] as const;
const fields = [
  'cityId',
  'name',
  'slug',
  'shortDescription',
  'fullDescription',
  'latitude',
  'longitude',
  'travelInfo',
] as const;

export async function GET(request: NextRequest) {
  return adminJson(
    request,
    `/admin/destinations${safeAdminQuery(request, query)}`,
  );
}

export async function POST(request: NextRequest) {
  return adminJson(request, '/admin/destinations', {
    body: await adminAllowedBody(request, fields),
    method: 'POST',
  });
}
