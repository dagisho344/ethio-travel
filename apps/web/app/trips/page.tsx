import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { TripsClient } from '../../components/trips/TripsClient';
import { Container } from '../../components/ui/Container';
import { SectionHeading } from '../../components/ui/States';
import { currentTokens } from '../../lib/auth/session';

export default async function TripsPage() {
  const t = await getTranslations('trips');
  const tokens = await currentTokens();
  if (!tokens.accessToken && !tokens.refreshToken) {
    redirect('/login?returnTo=/trips');
  }

  return (
    <main className="bg-slate-50">
      <Container className="py-10 sm:py-12">
        <SectionHeading
          eyebrow={t('eyebrow')}
          title={t('title')}
          description={t('description')}
        />
        <TripsClient />
      </Container>
    </main>
  );
}
