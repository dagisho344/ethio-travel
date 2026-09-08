import { redirect } from 'next/navigation';
import { Container } from '../../components/ui/Container';
import { SectionHeading } from '../../components/ui/States';
import { currentTokens } from '../../lib/auth/session';
import { BookingsClient } from './BookingsClient';

export default async function BookingsPage() {
  const tokens = await currentTokens();
  if (!tokens.accessToken && !tokens.refreshToken) {
    redirect('/login?returnTo=/bookings');
  }

  return (
    <main className="bg-slate-50">
      <Container className="py-10 sm:py-12">
        <SectionHeading
          eyebrow="Bookings"
          title="My Bookings"
          description="Review your booking requests, confirmations and payment status."
        />
        <BookingsClient />
      </Container>
    </main>
  );
}
