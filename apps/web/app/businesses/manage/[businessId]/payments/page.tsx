import { redirect } from 'next/navigation';
import { BusinessPaymentsClient } from '../../../[businessId]/payments/BusinessPaymentsClient';
import { currentTokens } from '../../../../../lib/auth/session';
export default async function ManagedBusinessPaymentsPage() {
  const tokens = await currentTokens();
  if (!tokens.accessToken && !tokens.refreshToken)
    redirect('/login?returnTo=/businesses/manage');
  return <BusinessPaymentsClient />;
}
