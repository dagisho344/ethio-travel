import { redirect } from 'next/navigation';
import { BusinessWorkspaceClient } from '../../../../components/businesses/BusinessWorkspaceClient';
import { currentTokens } from '../../../../lib/auth/session';

type PageProps = { params: Promise<{ businessId: string }> };

export default async function BusinessWorkspacePage({ params }: PageProps) {
  const tokens = await currentTokens();
  if (!tokens.accessToken && !tokens.refreshToken) {
    redirect('/login?returnTo=/businesses/manage');
  }
  const { businessId } = await params;
  return <BusinessWorkspaceClient businessId={businessId} />;
}
