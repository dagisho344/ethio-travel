import { redirect } from 'next/navigation';
import { BusinessServiceWorkspaceClient } from '../../../../../../components/businesses/BusinessServiceWorkspaceClient';
import { currentTokens } from '../../../../../../lib/auth/session';

export default async function BusinessServiceWorkspacePage({
  params,
}: {
  params: Promise<{ businessId: string; serviceId: string }>;
}) {
  const tokens = await currentTokens();
  if (!tokens.accessToken && !tokens.refreshToken) {
    redirect('/login?returnTo=/businesses/manage');
  }
  const { businessId, serviceId } = await params;
  return (
    <BusinessServiceWorkspaceClient
      businessId={businessId}
      serviceId={serviceId}
    />
  );
}
