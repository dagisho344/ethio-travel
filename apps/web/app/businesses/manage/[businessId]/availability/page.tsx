import { redirect } from 'next/navigation';
import { BusinessAvailabilityIndexClient } from '../../../../../components/businesses/BusinessAvailabilityIndexClient';
import { currentTokens } from '../../../../../lib/auth/session';

export default async function BusinessAvailabilityIndexPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const tokens = await currentTokens();
  if (!tokens.accessToken && !tokens.refreshToken) {
    redirect('/login?returnTo=/businesses/manage');
  }
  const { businessId } = await params;
  return <BusinessAvailabilityIndexClient businessId={businessId} />;
}
