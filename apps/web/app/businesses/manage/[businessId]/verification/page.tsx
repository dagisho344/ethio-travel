import { redirect } from 'next/navigation';
import { BusinessVerificationClient } from '../../../../../components/businesses/BusinessVerificationClient';
import { currentTokens } from '../../../../../lib/auth/session';

type PageProps = { params: Promise<{ businessId: string }> };
export default async function BusinessVerificationPage({ params }: PageProps) {
  const tokens = await currentTokens();
  if (!tokens.accessToken && !tokens.refreshToken)
    redirect('/login?returnTo=/businesses/manage');
  const { businessId } = await params;
  return <BusinessVerificationClient businessId={businessId} />;
}
