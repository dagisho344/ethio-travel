import type { NextRequest } from 'next/server';
import { jsonError } from '../../../../../../../../lib/auth/session';
import { adminIds, adminResponse } from '../../../../bff';
type Context = {
  params: Promise<{ verificationId: string; documentId: string }>;
};
export async function GET(request: NextRequest, context: Context) {
  try {
    const { verificationId, documentId } = await adminIds(context.params);
    return adminResponse(
      request,
      `/admin/business-verifications/${verificationId}/documents/${documentId}/access`,
    );
  } catch (error) {
    return jsonError(error);
  }
}
