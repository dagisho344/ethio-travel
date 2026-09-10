import { redirect } from 'next/navigation';
import { BusinessLocationsClient } from '../../../../../components/businesses/BusinessLocationsClient';
import { currentTokens } from '../../../../../lib/auth/session';

type PageProps = { params: Promise<{ businessId: string }> };
export default async function BusinessLocationsPage({ params }: PageProps) {
  const tokens = await currentTokens();
  if (!tokens.accessToken && !tokens.refreshToken)
    redirect('/login?returnTo=/businesses/manage');
  const { businessId } = await params;
  return <BusinessLocationsClient businessId={businessId} />;
}
