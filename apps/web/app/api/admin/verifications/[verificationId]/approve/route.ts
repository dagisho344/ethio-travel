import type { NextRequest } from 'next/server';
import { jsonError } from '../../../../../../lib/auth/session';
import { adminIds, adminMutationBody, adminResponse } from '../../bff';
type Context = { params: Promise<{ verificationId: string }> };
export async function POST(request: NextRequest, context: Context) {
  try {
    const { verificationId } = await adminIds(context.params);
    return adminResponse(
      request,
      `/admin/business-verifications/${verificationId}/approve`,
      { method: 'POST', body: await adminMutationBody(request) },
    );
  } catch (error) {
    return jsonError(error);
  }
}
