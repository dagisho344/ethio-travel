import { redirect } from 'next/navigation';
import { BusinessOnboardingWizard } from '../../../components/businesses/BusinessOnboardingWizard';
import { Container } from '../../../components/ui/Container';
import { SectionHeading } from '../../../components/ui/States';
import { currentTokens } from '../../../lib/auth/session';

export default async function BusinessOnboardingPage() {
  const tokens = await currentTokens();
  if (!tokens.accessToken && !tokens.refreshToken) {
    redirect('/login?returnTo=/business/onboarding');
  }

  return (
    <main className="bg-slate-50">
      <Container className="max-w-4xl py-10 sm:py-12">
        <SectionHeading
          eyebrow="List your business"
          title="Build your business draft"
          description="Add the real details, location and contact information that EthioTravel will use for your verification setup."
        />
        <BusinessOnboardingWizard />
      </Container>
    </main>
  );
}
