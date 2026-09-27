import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Container } from '../../components/ui/Container';
import { SectionHeading } from '../../components/ui/States';
import { currentTokens } from '../../lib/auth/session';
import { ReviewsClient } from './ReviewsClient';

export default async function ReviewsPage() {
  const tokens = await currentTokens();
  if (!tokens.accessToken && !tokens.refreshToken) {
    redirect('/login?returnTo=/reviews');
  }

  const t = await getTranslations('travelerReviews');

  return (
    <main className="bg-slate-50">
      <Container className="py-10 sm:py-12">
        <SectionHeading
          eyebrow={t('eyebrow')}
          title={t('title')}
          description={t('description')}
        />
        <ReviewsClient />
      </Container>
    </main>
  );
}
