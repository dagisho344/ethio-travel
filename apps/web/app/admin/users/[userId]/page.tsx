import { AdminUserDetailClient } from './AdminUserDetailClient';

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  return <AdminUserDetailClient userId={userId} />;
}
