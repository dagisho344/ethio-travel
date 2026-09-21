import type { Metadata } from 'next';
import { CategoryMarketplacePage } from '../../components/public/CategoryMarketplacePage';

export const metadata: Metadata = {
  title: 'Hotels | EthioTravel',
  description: 'Browse verified accommodation services across Ethiopia.',
};

export default function HotelsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <CategoryMarketplacePage
      family="ACCOMMODATION"
      searchParams={searchParams}
    />
  );
}
