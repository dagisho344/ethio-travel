import type { NextRequest } from 'next/server';
import { adminError, adminJson, adminUuid } from '../../../bff';
import {
  idempotencyHeader,
  readOptionalJson,
  refundCreateBody,
} from '../../../../../../lib/payment-bff';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const body = refundCreateBody(await readOptionalJson(request));
    return await adminJson(
      request,
      '/admin/payments/' + adminUuid(id, 'Payment') + '/refund',
      {
        body: JSON.stringify(body),
        headers: {
          ...idempotencyHeader(request),
          'content-type': 'application/json',
        },
        method: 'POST',
      },
    );
  } catch (error) {
    return adminError(error);
  }
}
