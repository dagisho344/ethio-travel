import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { BusinessOnboardingWizard } from '../../../components/businesses/BusinessOnboardingWizard';
import { Container } from '../../../components/ui/Container';
import { SectionHeading } from '../../../components/ui/States';
import { currentTokens } from '../../../lib/auth/session';

export default async function BusinessOnboardingPage() {
  const t = await getTranslations('businessOnboarding');
  const tokens = await currentTokens();
  if (!tokens.accessToken && !tokens.refreshToken) {
    redirect('/login?returnTo=/business/onboarding');
  }

  return (
    <main className="bg-slate-50">
      <Container className="max-w-4xl py-10 sm:py-12">
        <SectionHeading
          eyebrow={t('eyebrow')}
          title={t('title')}
          description={t('description')}
        />
        <BusinessOnboardingWizard />
      </Container>
    </main>
  );
}
