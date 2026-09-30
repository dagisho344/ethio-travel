import { AdminUserForm } from '../../AdminUserForm';
import { currentSessionSnapshot } from '../../../../../lib/auth/session';

export default async function AdminEditUserPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const session = await currentSessionSnapshot();
  return <AdminUserForm userId={userId} currentUserId={session.user?.id} />;
}
