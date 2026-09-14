import { AdminReportDetailClient } from './AdminReportDetailClient';

export default async function AdminReportDetailPage({
  params,
}: {
  params: Promise<{ reportId: string }>;
}) {
  const { reportId } = await params;
  return <AdminReportDetailClient reportId={reportId} />;
}
