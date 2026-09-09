import { redirect } from 'next/navigation';
import { TripPlannerClient } from '../../../components/trips/TripPlannerClient';
import { currentTokens } from '../../../lib/auth/session';

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tokens = await currentTokens();
  if (!tokens.accessToken && !tokens.refreshToken) {
    redirect(`/login?returnTo=${encodeURIComponent(`/trips/${id}`)}`);
  }
  return <TripPlannerClient tripId={id} />;
}
