import { redirect } from 'next/navigation';
import { BusinessBookingsClient } from '../../../[businessId]/bookings/BusinessBookingsClient';
import { currentTokens } from '../../../../../lib/auth/session';
export default async function ManagedBusinessBookingsPage() {
  const tokens = await currentTokens();
  if (!tokens.accessToken && !tokens.refreshToken)
    redirect('/login?returnTo=/businesses/manage');
  return <BusinessBookingsClient />;
}
