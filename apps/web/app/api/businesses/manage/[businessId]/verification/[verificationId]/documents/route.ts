import type { NextRequest } from 'next/server';
import { jsonError } from '../../../../../../../../lib/auth/session';
import { verificationIds, verificationMultipartResponse } from '../../bff';

type Context = {
  params: Promise<{ businessId: string; verificationId: string }>;
};
export async function POST(request: NextRequest, context: Context) {
  try {
    const { businessId, verificationId } = await verificationIds(
      context.params,
    );
    return verificationMultipartResponse(
      request,
      `/my/businesses/${businessId}/verifications/${verificationId}/documents`,
    );
  } catch (error) {
    return jsonError(error);
  }
}
