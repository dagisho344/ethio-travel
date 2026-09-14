import { AdminBusinessDetailClient } from './AdminBusinessDetailClient';

export default async function AdminBusinessDetailPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  return <AdminBusinessDetailClient businessId={businessId} />;
}
