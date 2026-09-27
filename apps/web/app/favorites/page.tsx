import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Container } from '../../components/ui/Container';
import { SectionHeading } from '../../components/ui/States';
import { currentTokens } from '../../lib/auth/session';
import { FavoritesClient } from './FavoritesClient';

export default async function FavoritesPage() {
  const tokens = await currentTokens();
  if (!tokens.accessToken && !tokens.refreshToken) {
    redirect('/login?returnTo=/favorites');
  }

  const t = await getTranslations('favorites');

  return (
    <main className="bg-slate-50">
      <Container className="py-10 sm:py-12">
        <SectionHeading
          eyebrow={t('eyebrow')}
          title={t('title')}
          description={t('description')}
        />
        <FavoritesClient />
      </Container>
    </main>
  );
}
