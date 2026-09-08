import { redirect } from 'next/navigation';
import { Container } from '../../../../components/ui/Container';
import { SectionHeading } from '../../../../components/ui/States';
import { currentTokens } from '../../../../lib/auth/session';
import { BusinessBookingsClient } from './BusinessBookingsClient';

export default async function BusinessBookingsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const tokens = await currentTokens();
  const { businessId } = await params;
  if (!tokens.accessToken && !tokens.refreshToken) {
    redirect(`/login?returnTo=/businesses/${businessId}/bookings`);
  }

  return (
    <main className="bg-slate-50">
      <Container className="py-10 sm:py-12">
        <SectionHeading
          eyebrow="Business Bookings"
          title="Booking Management"
          description="Review service booking requests and manage confirmed bookings."
        />
        <BusinessBookingsClient />
      </Container>
    </main>
  );
}
