import {
  authenticatedMeResponse,
  jsonError,
} from '../../../../lib/auth/session';

export async function GET() {
  try {
    return await authenticatedMeResponse();
  } catch (error) {
    return jsonError(error);
  }
}
