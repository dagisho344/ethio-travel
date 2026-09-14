import { AdminReviewDetailClient } from './AdminReviewDetailClient';

export default async function AdminReviewDetailPage({
  params,
}: {
  params: Promise<{ reviewId: string }>;
}) {
  const { reviewId } = await params;
  return <AdminReviewDetailClient reviewId={reviewId} />;
}
