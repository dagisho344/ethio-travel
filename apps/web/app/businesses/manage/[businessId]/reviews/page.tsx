import { redirect } from 'next/navigation';
import { BusinessReviewsClient } from '../../../../../components/businesses/BusinessReviewsClient';
import { currentTokens } from '../../../../../lib/auth/session';
export default async function Page({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const tokens = await currentTokens();
  if (!tokens.accessToken && !tokens.refreshToken)
    redirect('/login?returnTo=/businesses/manage');
  const { businessId } = await params;
  return <BusinessReviewsClient businessId={businessId} />;
}
