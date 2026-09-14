import type { NextRequest } from 'next/server';
import { adminJson } from '../bff';

export async function GET(request: NextRequest) {
  return adminJson(request, '/admin/dashboard');
}
