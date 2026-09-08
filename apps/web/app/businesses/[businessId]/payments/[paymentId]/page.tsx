import { redirect } from 'next/navigation';
import { Container } from '../../../../../components/ui/Container';
import { SectionHeading } from '../../../../../components/ui/States';
import { currentTokens } from '../../../../../lib/auth/session';
import { BusinessPaymentDetailClient } from './BusinessPaymentDetailClient';

export default async function BusinessPaymentDetailPage({
  params,
}: {
  params: Promise<{ businessId: string; paymentId: string }>;
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
          title="Payment Detail"
          description="Read-only payment and refund history for this business."
        />
        <BusinessPaymentDetailClient />
      </Container>
    </main>
  );
}
