import { redirect } from 'next/navigation';
import { TripsClient } from '../../components/trips/TripsClient';
import { Container } from '../../components/ui/Container';
import { SectionHeading } from '../../components/ui/States';
import { currentTokens } from '../../lib/auth/session';

export default async function TripsPage() {
  const tokens = await currentTokens();
  if (!tokens.accessToken && !tokens.refreshToken) {
    redirect('/login?returnTo=/trips');
  }

  return (
    <main className="bg-slate-50">
      <Container className="py-10 sm:py-12">
        <SectionHeading
          eyebrow="Trip Planner"
          title="My Trips"
          description="Organize your days, saved places and confirmed bookings in one private itinerary."
        />
        <TripsClient />
      </Container>
    </main>
  );
}
