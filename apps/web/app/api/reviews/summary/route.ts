import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { backendJson, jsonError } from '../../../../lib/auth/session';
import type { ReviewTargetType } from '../../../../lib/types';

const allowedTargetTypes = new Set<ReviewTargetType>([
  'BUSINESS',
  'SERVICE',
  'DESTINATION',
  'ATTRACTION',
]);

export async function GET(request: NextRequest) {
  try {
    const source = request.nextUrl.searchParams;
    const targetType = source.get('targetType') as ReviewTargetType | null;
    const targetId = source.get('targetId');
    const query = new URLSearchParams();
    if (targetType && allowedTargetTypes.has(targetType)) {
      query.set('targetType', targetType);
    }
    if (targetId) query.set('targetId', targetId);
    return NextResponse.json(await backendJson(`/reviews/summary?${query}`));
  } catch (error) {
    return jsonError(error);
  }
}
