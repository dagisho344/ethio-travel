import type { NextRequest } from 'next/server';
import { BffAuthError } from '../../../../../../lib/auth/session';
import {
  adminError,
  createAccountBody,
  destinationConfigId,
  sensitiveAdminJson,
} from '../booking-config/bff';

type Context = { params: Promise<{ destinationId: string }> };

export async function GET(request: NextRequest, { params }: Context) {
  try {
    const id = destinationConfigId((await params).destinationId);
    const query = request.nextUrl.searchParams;
    if ([...query.keys()].some((key) => !['page', 'limit'].includes(key)))
      throw new BffAuthError(400, 'Invalid account query.');
    if (query.getAll('page').length > 1 || query.getAll('limit').length > 1)
      throw new BffAuthError(400, 'Invalid account query.');
    const page = query.get('page') ?? '1';
    const limit = query.get('limit') ?? '20';
    if (
      !/^[1-9]\d*$/.test(page) ||
      !/^[1-9]\d*$/.test(limit) ||
      Number(page) > 1000000 ||
      Number(limit) > 100
    )
      throw new BffAuthError(400, 'Invalid account query.');
    return sensitiveAdminJson(
      request,
      `/admin/destinations/${id}/payment-accounts?page=${page}&limit=${limit}`,
    );
  } catch (error) {
    return adminError(error);
  }
}

export async function POST(request: NextRequest, { params }: Context) {
  try {
    const id = destinationConfigId((await params).destinationId);
    return sensitiveAdminJson(
      request,
      `/admin/destinations/${id}/payment-accounts`,
      { method: 'POST', body: await createAccountBody(request) },
    );
  } catch (error) {
    return adminError(error);
  }
}
