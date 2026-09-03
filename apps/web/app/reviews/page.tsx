import { redirect } from 'next/navigation';
import { Container } from '../../components/ui/Container';
import { SectionHeading } from '../../components/ui/States';
import { currentTokens } from '../../lib/auth/session';
import { ReviewsClient } from './ReviewsClient';

export default async function ReviewsPage() {
  const tokens = await currentTokens();
  if (!tokens.accessToken && !tokens.refreshToken) {
    redirect('/login?returnTo=/reviews');
  }

  return (
    <main className="bg-slate-50">
      <Container className="py-10 sm:py-12">
        <SectionHeading
          eyebrow="Reviews"
          title="My Reviews"
          description="Track your submitted traveler reviews and moderation status."
        />
        <ReviewsClient />
      </Container>
    </main>
  );
}
