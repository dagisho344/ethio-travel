import { redirect } from 'next/navigation';
import { BusinessTourClient } from '../../../../../../../components/businesses/BusinessTourClient';
import { currentTokens } from '../../../../../../../lib/auth/session';

export default async function BusinessTourPage({
  params,
}: {
  params: Promise<{ businessId: string; serviceId: string }>;
}) {
  const tokens = await currentTokens();
  if (!tokens.accessToken && !tokens.refreshToken) {
    redirect('/login?returnTo=/businesses/manage');
  }
  const { businessId, serviceId } = await params;
  return <BusinessTourClient businessId={businessId} serviceId={serviceId} />;
}
