import { redirect } from 'next/navigation';
import { Container } from '../../../components/ui/Container';
import { currentTokens } from '../../../lib/auth/session';
import { BookingDetailClient } from './BookingDetailClient';

export default async function BookingDetailPage() {
  const tokens = await currentTokens();
  if (!tokens.accessToken && !tokens.refreshToken) {
    redirect('/login?returnTo=/bookings');
  }

  return (
    <main className="bg-slate-50">
      <Container className="py-10 sm:py-12">
        <BookingDetailClient />
      </Container>
    </main>
  );
}
