import type { NextRequest } from 'next/server';
import {
  adminError,
  destinationAccountId,
  destinationConfigId,
  sensitiveAdminJson,
  updateAccountBody,
} from '../../booking-config/bff';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ destinationId: string; accountId: string }> },
) {
  try {
    const { destinationId, accountId } = await params;
    const destination = destinationConfigId(destinationId);
    const account = destinationAccountId(accountId);
    return sensitiveAdminJson(
      request,
      `/admin/destinations/${destination}/payment-accounts/${account}`,
      { method: 'PATCH', body: await updateAccountBody(request) },
    );
  } catch (error) {
    return adminError(error);
  }
}
