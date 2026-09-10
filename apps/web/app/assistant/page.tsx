import { redirect } from 'next/navigation';
import { AiAssistantClient } from '../../components/ai/AiAssistantClient';
import { currentTokens } from '../../lib/auth/session';

export default async function AssistantPage() {
  const tokens = await currentTokens();
  if (!tokens.accessToken && !tokens.refreshToken)
    redirect('/login?returnTo=/assistant');
  return <AiAssistantClient />;
}
