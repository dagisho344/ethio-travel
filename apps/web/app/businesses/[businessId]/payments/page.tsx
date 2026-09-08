import { redirect } from 'next/navigation';
import { Container } from '../../../../components/ui/Container';
import { SectionHeading } from '../../../../components/ui/States';
import { currentTokens } from '../../../../lib/auth/session';
import { BusinessPaymentsClient } from './BusinessPaymentsClient';

export default async function BusinessPaymentsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const tokens = await currentTokens();
  const { businessId } = await params;
  if (!tokens.accessToken && !tokens.refreshToken) {
    redirect(`/login?returnTo=/businesses/${businessId}/payments`);
  }

  return (
    <main className="bg-slate-50">
      <Container className="py-10 sm:py-12">
        <SectionHeading
          eyebrow="Business Payments"
          title="Payment Activity"
          description="Review booking payments and provider status for this business."
        />
        <BusinessPaymentsClient />
      </Container>
    </main>
  );
}
