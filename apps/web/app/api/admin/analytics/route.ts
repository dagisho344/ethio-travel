import type { NextRequest } from 'next/server';
import { adminError, adminJson } from '../bff';

export async function GET(request: NextRequest) {
  try {
    return await adminJson(request, '/admin/analytics');
  } catch (error) {
    return adminError(error);
  }
}
