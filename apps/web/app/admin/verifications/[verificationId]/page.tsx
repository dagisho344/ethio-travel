import { redirect } from 'next/navigation';
import { Container } from '../../../../components/ui/Container';
import { SectionHeading } from '../../../../components/ui/States';
import { currentTokens } from '../../../../lib/auth/session';
import { AdminVerificationDetailClient } from './AdminVerificationDetailClient';
export default async function AdminVerificationDetailPage() {
  const tokens = await currentTokens();
  if (!tokens.accessToken && !tokens.refreshToken)
    redirect('/login?returnTo=/admin/verifications');
  return (
    <main className="bg-slate-50">
      <Container className="py-10 sm:py-12">
        <SectionHeading
          eyebrow="Admin Verification"
          title="Verification Review"
          description="Review evidence and record an authorized decision."
        />
        <AdminVerificationDetailClient />
      </Container>
    </main>
  );
}
