import { redirect } from 'next/navigation';
import { NotificationCenterClient } from '../../components/notifications/NotificationCenterClient';
import { Container } from '../../components/ui/Container';
import { currentTokens } from '../../lib/auth/session';

export default async function NotificationsPage() {
  const tokens = await currentTokens();
  if (!tokens.accessToken && !tokens.refreshToken) {
    redirect('/login?returnTo=/notifications');
  }
  return (
    <main className="min-h-[calc(100vh-12rem)] bg-slate-50">
      <Container className="py-8 sm:py-12">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-highland">
            Notifications
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">
            Stay up to date
          </h1>
          <p className="mt-2 text-slate-600">
            Booking, payment, message, verification and review updates are saved
            here.
          </p>
        </div>
        <NotificationCenterClient />
      </Container>
    </main>
  );
}
