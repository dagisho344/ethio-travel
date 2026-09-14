import { AdminDestinationEditor } from '../AdminDestinationEditor';

export default async function AdminDestinationDetailPage({
  params,
}: {
  params: Promise<{ destinationId: string }>;
}) {
  const { destinationId } = await params;
  return (
    <AdminDestinationEditor destinationId={destinationId} editable={false} />
  );
}
