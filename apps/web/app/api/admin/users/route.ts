import type { NextRequest } from 'next/server';
import {
  adminAllowedBody,
  adminError,
  adminJson,
  safeAdminQuery,
} from '../bff';

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

const createFields = [
  'firstName',
  'lastName',
  'email',
  'phone',
  'roles',
  'temporaryPassword',
] as const;

export async function POST(request: NextRequest) {
  try {
    return adminJson(request, '/admin/users', {
      method: 'POST',
      body: await adminAllowedBody(request, createFields, true),
    });
  } catch (error) {
    return adminError(error);
  }
}
