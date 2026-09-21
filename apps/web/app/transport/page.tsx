import type { Metadata } from 'next';
import { CategoryMarketplacePage } from '../../components/public/CategoryMarketplacePage';

export const metadata: Metadata = {
  title: 'Transport | EthioTravel',
  description:
    'Browse verified transport services and scheduled travel options.',
};

export default function TransportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <CategoryMarketplacePage family="TRANSPORT" searchParams={searchParams} />
  );
}
