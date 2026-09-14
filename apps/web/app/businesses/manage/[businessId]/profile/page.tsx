import { redirect } from 'next/navigation';
import { BusinessProfileClient } from '../../../../../components/businesses/BusinessProfileClient';
import { currentTokens } from '../../../../../lib/auth/session';

export default async function BusinessProfilePage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const tokens = await currentTokens();
  if (!tokens.accessToken && !tokens.refreshToken) {
    redirect('/login?returnTo=/businesses/manage');
  }
  const { businessId } = await params;
  return <BusinessProfileClient businessId={businessId} />;
}
