import { redirect } from 'next/navigation';
import { CreateTripForm } from '../../../components/trips/CreateTripForm';
import { Container } from '../../../components/ui/Container';
import { SectionHeading } from '../../../components/ui/States';
import { currentTokens } from '../../../lib/auth/session';

export default async function NewTripPage() {
  const tokens = await currentTokens();
  if (!tokens.accessToken && !tokens.refreshToken) {
    redirect('/login?returnTo=/trips/new');
  }

  return (
    <main className="bg-slate-50">
      <Container className="max-w-3xl py-10 sm:py-12">
        <SectionHeading
          eyebrow="Trip Planner"
          title="Plan a new trip"
          description="Choose real locations, set calendar dates, and build a day-by-day itinerary."
        />
        <CreateTripForm />
      </Container>
    </main>
  );
}
