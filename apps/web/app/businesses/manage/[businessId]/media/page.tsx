import { redirect } from 'next/navigation';
import { BusinessMediaClient } from '../../../../../components/businesses/BusinessMediaClient';
import { currentTokens } from '../../../../../lib/auth/session';

type PageProps = { params: Promise<{ businessId: string }> };
export default async function BusinessMediaPage({ params }: PageProps) {
  const tokens = await currentTokens();
  if (!tokens.accessToken && !tokens.refreshToken)
    redirect('/login?returnTo=/businesses/manage');
  const { businessId } = await params;
  return <BusinessMediaClient businessId={businessId} />;
}
