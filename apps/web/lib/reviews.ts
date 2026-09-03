import { backendJson, currentTokens } from './auth/session';
import type {
  MyReview,
  PaginatedResponse,
  ReviewTargetType,
  ReviewStatus,
} from './types';

export type ReviewLookup = Record<string, MyReview>;

export function reviewLookupKey(
  targetType: ReviewTargetType,
  targetId: string,
): string {
  return `${targetType}:${targetId}`;
}

export function buildReviewLookup(reviews: MyReview[]): ReviewLookup {
  return Object.fromEntries(
    reviews.map((review) => [
      reviewLookupKey(review.target.type, review.target.id),
      review,
    ]),
  );
}

export async function getInitialReviewLookup(
  targetType?: ReviewTargetType,
  status?: ReviewStatus,
): Promise<ReviewLookup> {
  const { accessToken } = await currentTokens();
  if (!accessToken) return {};

  const query = new URLSearchParams({ mine: 'true', limit: '100' });
  if (targetType) query.set('targetType', targetType);
  if (status) query.set('status', status);

  try {
    const response = await backendJson<PaginatedResponse<MyReview>>(
      `/users/me/reviews?${query.toString().replace('mine=true&', '')}`,
      { headers: { authorization: `Bearer ${accessToken}` } },
    );
    return buildReviewLookup(response.data);
  } catch {
    return {};
  }
}
