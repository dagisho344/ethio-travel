import { AdminUserDetailClient } from './AdminUserDetailClient';
import { currentSessionSnapshot } from '../../../../lib/auth/session';

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const session = await currentSessionSnapshot();
  return (
    <AdminUserDetailClient
      userId={userId}
      currentUserId={session.user?.id ?? ''}
    />
  );
}
