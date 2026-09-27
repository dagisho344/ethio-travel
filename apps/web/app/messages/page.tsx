import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { MessagingInboxClient } from '../../components/messaging/MessagingInboxClient';
import { Container } from '../../components/ui/Container';
import { currentTokens } from '../../lib/auth/session';

export default async function MessagesPage() {
  const tokens = await currentTokens();
  if (!tokens.accessToken && !tokens.refreshToken) {
    redirect('/login?returnTo=/messages');
  }
  const t = await getTranslations('messaging');
  return (
    <main className="min-h-[calc(100vh-12rem)] bg-slate-50">
      <Container className="py-8 sm:py-12">
        <div className="mb-6">
          <p className="text-sm font-semibold uppercase tracking-wide text-highland">
            {t('eyebrow')}
          </p>
          <h1 className="mt-1 text-3xl font-bold text-slate-950">
            {t('title')}
          </h1>
          <p className="mt-2 max-w-2xl text-slate-600">{t('description')}</p>
        </div>
        <MessagingInboxClient />
      </Container>
    </main>
  );
}
