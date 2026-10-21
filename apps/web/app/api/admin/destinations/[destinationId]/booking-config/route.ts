import type { NextRequest } from 'next/server';
import {
  adminError,
  configBody,
  destinationConfigId,
  sensitiveAdminJson,
} from './bff';

type Context = { params: Promise<{ destinationId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const id = destinationConfigId((await params).destinationId);
    return sensitiveAdminJson(
      request,
      `/admin/destinations/${id}/booking-config`,
    );
  } catch (error) {
    return adminError(error);
  }
}

export async function PUT(request: NextRequest, { params }: Context) {
  try {
    const id = destinationConfigId((await params).destinationId);
    return sensitiveAdminJson(
      request,
      `/admin/destinations/${id}/booking-config`,
      { method: 'PUT', body: await configBody(request) },
    );
  } catch (error) {
    return adminError(error);
  }
}
