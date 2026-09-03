import { redirect } from 'next/navigation';
import { Container } from '../../components/ui/Container';
import { SectionHeading } from '../../components/ui/States';
import { currentTokens } from '../../lib/auth/session';
import { FavoritesClient } from './FavoritesClient';

export default async function FavoritesPage() {
  const tokens = await currentTokens();
  if (!tokens.accessToken && !tokens.refreshToken) {
    redirect('/login?returnTo=/favorites');
  }

  return (
    <main className="bg-slate-50">
      <Container className="py-10 sm:py-12">
        <SectionHeading
          eyebrow="Favorites"
          title="My Favorites"
          description="Keep track of the Ethiopian places, businesses and services you want to come back to."
        />
        <FavoritesClient />
      </Container>
    </main>
  );
}
