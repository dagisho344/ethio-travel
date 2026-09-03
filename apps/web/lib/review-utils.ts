import type { MyReview, ReviewTargetType } from './types';

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
