import { redirect } from 'next/navigation';
import { Container } from '../../../components/ui/Container';
import { SectionHeading } from '../../../components/ui/States';
import { currentTokens } from '../../../lib/auth/session';
import { AdminVerificationsClient } from './AdminVerificationsClient';
export default async function AdminVerificationsPage() {
  const tokens = await currentTokens();
  if (!tokens.accessToken && !tokens.refreshToken)
    redirect('/login?returnTo=/admin/verifications');
  return (
    <main className="bg-slate-50">
      <Container className="py-10 sm:py-12">
        <SectionHeading
          eyebrow="Admin Verification"
          title="Business Verification Queue"
          description="Review private evidence for submitted business verification requests."
        />
        <AdminVerificationsClient />
      </Container>
    </main>
  );
}
