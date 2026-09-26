import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CategoryMarketplacePage } from '../../components/public/CategoryMarketplacePage';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('services');
  return {
    title: `${t('familyTransport')} | EthioTravel`,
    description: t('familyTransportDescription'),
  };
}

export default function TransportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <CategoryMarketplacePage family="TRANSPORT" searchParams={searchParams} />
  );
}
