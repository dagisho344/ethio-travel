import { redirect } from 'next/navigation';
import { BusinessRestaurantClient } from '../../../../../../../components/businesses/BusinessRestaurantClient';
import { currentTokens } from '../../../../../../../lib/auth/session';

export default async function BusinessRestaurantPage({
  params,
}: {
  params: Promise<{ businessId: string; serviceId: string }>;
}) {
  const tokens = await currentTokens();
  if (!tokens.accessToken && !tokens.refreshToken) {
    redirect('/login?returnTo=/businesses/manage');
  }
  const { businessId, serviceId } = await params;
  return (
    <BusinessRestaurantClient businessId={businessId} serviceId={serviceId} />
  );
}
