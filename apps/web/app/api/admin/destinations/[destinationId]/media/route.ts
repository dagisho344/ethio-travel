import type { NextRequest } from 'next/server';
import { adminError, adminJson, safeAdminQuery } from '../../../bff';
import { destinationMediaIds, destinationMediaUpload } from './bff';

type Context = { params: Promise<{ destinationId: string }> };

export async function GET(request: NextRequest, context: Context) {
  try {
    const { destinationId } = destinationMediaIds(
      (await context.params).destinationId,
    );
    return adminJson(
      request,
      `/admin/destinations/${destinationId}/media${safeAdminQuery(request, ['page', 'limit'])}`,
    );
  } catch (error) {
    return adminError(error);
  }
}

export async function POST(request: NextRequest, context: Context) {
  try {
    const { destinationId } = destinationMediaIds(
      (await context.params).destinationId,
    );
    return destinationMediaUpload(
      request,
      `/admin/destinations/${destinationId}/media/uploads`,
    );
  } catch (error) {
    return adminError(error);
  }
}
