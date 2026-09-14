import { redirect } from 'next/navigation';
import { BusinessSettingsClient } from '../../../../../components/businesses/BusinessSettingsClient';
import { currentTokens } from '../../../../../lib/auth/session';
export default async function BusinessSettingsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const tokens = await currentTokens();
  if (!tokens.accessToken && !tokens.refreshToken)
    redirect('/login?returnTo=/businesses/manage');
  const { businessId } = await params;
  return <BusinessSettingsClient businessId={businessId} />;
}
