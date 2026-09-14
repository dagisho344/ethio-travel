import { redirect } from 'next/navigation';
import { BusinessAvailabilityClient } from '../../../../../../../components/businesses/BusinessAvailabilityClient';
import { currentTokens } from '../../../../../../../lib/auth/session';
export default async function BusinessAvailabilityPage({
  params,
}: {
  params: Promise<{ businessId: string; serviceId: string }>;
}) {
  const tokens = await currentTokens();
  if (!tokens.accessToken && !tokens.refreshToken)
    redirect('/login?returnTo=/businesses/manage');
  const { businessId, serviceId } = await params;
  return (
    <BusinessAvailabilityClient businessId={businessId} serviceId={serviceId} />
  );
}
