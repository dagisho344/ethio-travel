import type { NextRequest } from 'next/server';
import {
  adminError,
  destinationAccountId,
  destinationConfigId,
  emptyAccountAction,
  sensitiveAdminJson,
} from '../../../booking-config/bff';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ destinationId: string; accountId: string }> },
) {
  try {
    const { destinationId, accountId } = await params;
    const destination = destinationConfigId(destinationId);
    const account = destinationAccountId(accountId);
    await emptyAccountAction(request);
    return sensitiveAdminJson(
      request,
      `/admin/destinations/${destination}/payment-accounts/${account}/deactivate`,
      { method: 'POST', body: '{}' },
    );
  } catch (error) {
    return adminError(error);
  }
}
