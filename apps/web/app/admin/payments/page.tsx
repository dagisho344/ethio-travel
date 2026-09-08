import { redirect } from 'next/navigation';
import { Container } from '../../../components/ui/Container';
import { SectionHeading } from '../../../components/ui/States';
import { currentTokens } from '../../../lib/auth/session';
import { AdminPaymentsClient } from './AdminPaymentsClient';

export default async function AdminPaymentsPage() {
  const tokens = await currentTokens();
  if (!tokens.accessToken && !tokens.refreshToken) {
    redirect('/login?returnTo=/admin/payments');
  }

  return (
    <main className="bg-slate-50">
      <Container className="py-10 sm:py-12">
        <SectionHeading
          eyebrow="Admin Payments"
          title="Payment Management"
          description="Inspect payment attempts, provider events and refund history."
        />
        <AdminPaymentsClient />
      </Container>
    </main>
  );
}
