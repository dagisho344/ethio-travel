import { redirect } from 'next/navigation';
import { BusinessServicesClient } from '../../../../../components/businesses/BusinessServicesClient';
import { currentTokens } from '../../../../../lib/auth/session';
export default async function BusinessServicesPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const tokens = await currentTokens();
  if (!tokens.accessToken && !tokens.refreshToken)
    redirect('/login?returnTo=/businesses/manage');
  const { businessId } = await params;
  return <BusinessServicesClient businessId={businessId} />;
}
