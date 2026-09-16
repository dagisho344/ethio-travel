import type { NextRequest } from 'next/server';
import { adminAllowedBody, adminError, adminJson } from '../bff';

const allowedFields = [
  'supportEmail',
  'supportPhone',
  'supportMessage',
] as const;

export async function GET(request: NextRequest) {
  try {
    return await adminJson(request, '/admin/settings');
  } catch (error) {
    return adminError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await adminAllowedBody(request, allowedFields, true);
    return await adminJson(request, '/admin/settings', {
      body,
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
    });
  } catch (error) {
    return adminError(error);
  }
}
