import type { NextRequest } from 'next/server';
import { jsonError } from '../../../../../../../../lib/auth/session';
import { verificationIds, verificationResponse } from '../../bff';

type Context = {
  params: Promise<{ businessId: string; verificationId: string }>;
};
export async function GET(request: NextRequest, context: Context) {
  try {
    const { businessId, verificationId } = await verificationIds(
      context.params,
    );
    return verificationResponse(
      request,
      `/my/businesses/${businessId}/verifications/${verificationId}/completeness`,
    );
  } catch (error) {
    return jsonError(error);
  }
}
