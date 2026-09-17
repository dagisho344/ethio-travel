import { redirect } from 'next/navigation';
import { BusinessAccommodationClient } from '../../../../../../../components/businesses/BusinessAccommodationClient';
import { currentTokens } from '../../../../../../../lib/auth/session';

export default async function BusinessAccommodationPage({
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
    <BusinessAccommodationClient
      businessId={businessId}
      serviceId={serviceId}
    />
  );
}
