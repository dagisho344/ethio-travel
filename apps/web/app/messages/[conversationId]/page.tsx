import { redirect } from 'next/navigation';
import { ConversationDetailClient } from '../../../components/messaging/ConversationDetailClient';
import { Container } from '../../../components/ui/Container';
import { currentTokens } from '../../../lib/auth/session';

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const tokens = await currentTokens();
  const { conversationId } = await params;
  if (!tokens.accessToken && !tokens.refreshToken) {
    redirect(
      `/login?returnTo=${encodeURIComponent(`/messages/${conversationId}`)}`,
    );
  }
  return (
    <main className="min-h-[calc(100vh-12rem)] bg-slate-50">
      <Container className="py-6 sm:py-10">
        <ConversationDetailClient />
      </Container>
    </main>
  );
}
