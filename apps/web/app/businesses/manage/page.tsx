import { redirect } from 'next/navigation';
import { MyBusinessesClient } from '../../../components/businesses/MyBusinessesClient';
import { Container } from '../../../components/ui/Container';
import { SectionHeading } from '../../../components/ui/States';
import { currentTokens } from '../../../lib/auth/session';

export default async function ManageBusinessesPage() {
  const tokens = await currentTokens();
  if (!tokens.accessToken && !tokens.refreshToken) {
    redirect('/login?returnTo=/businesses/manage');
  }

  return (
    <main className="bg-slate-50">
      <Container className="py-10 sm:py-12">
        <SectionHeading
          eyebrow="Business workspace"
          title="My Businesses"
          description="Continue the setup of businesses where you are an active member. Drafts remain private until verification approves them."
        />
        <MyBusinessesClient />
      </Container>
    </main>
  );
}
