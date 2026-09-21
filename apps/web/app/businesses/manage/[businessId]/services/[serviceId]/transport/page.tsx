import { redirect } from 'next/navigation';
import { BusinessTransportClient } from '../../../../../../../components/businesses/BusinessTransportClient';
import { currentTokens } from '../../../../../../../lib/auth/session';

export default async function BusinessTransportPage({
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
    <BusinessTransportClient businessId={businessId} serviceId={serviceId} />
  );
}
