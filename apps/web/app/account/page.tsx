import { redirect } from 'next/navigation';
import { AccountProfileClient } from '../../components/account/AccountProfileClient';
import { Container } from '../../components/ui/Container';
import { currentTokens } from '../../lib/auth/session';

export default async function AccountPage() {
  const tokens = await currentTokens();
  if (!tokens.accessToken && !tokens.refreshToken) {
    redirect('/login?returnTo=%2Faccount');
  }

  return (
    <main className="min-h-[calc(100vh-12rem)] bg-slate-50">
      <Container className="py-8 sm:py-12">
        <AccountProfileClient />
      </Container>
    </main>
  );
}
