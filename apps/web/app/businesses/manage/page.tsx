import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { MyBusinessesClient } from '../../../components/businesses/MyBusinessesClient';
import { Container } from '../../../components/ui/Container';
import { SectionHeading } from '../../../components/ui/States';
import { currentTokens } from '../../../lib/auth/session';

export default async function ManageBusinessesPage() {
  const t = await getTranslations('businessPortal');
  const tokens = await currentTokens();
  if (!tokens.accessToken && !tokens.refreshToken) {
    redirect('/login?returnTo=/businesses/manage');
  }

  return (
    <main className="bg-slate-50">
      <Container className="py-10 sm:py-12">
        <SectionHeading
          eyebrow={t('workspace')}
          title={t('myBusinesses')}
          description={t('activeMemberNotice')}
        />
        <MyBusinessesClient />
      </Container>
    </main>
  );
}
