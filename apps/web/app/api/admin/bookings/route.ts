import type { NextRequest } from 'next/server';
import { adminError, adminJson, safeAdminQuery } from '../bff';

const allowedQuery = [
  'page',
  'limit',
  'status',
  'reference',
  'traveler',
  'business',
  'service',
  'startFrom',
  'startTo',
  'createdFrom',
  'createdTo',
] as const;

export async function GET(request: NextRequest) {
  try {
    return await adminJson(
      request,
      '/admin/bookings' + safeAdminQuery(request, allowedQuery),
    );
  } catch (error) {
    return adminError(error);
  }
}
