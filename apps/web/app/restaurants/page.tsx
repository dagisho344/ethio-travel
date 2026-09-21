import type { Metadata } from 'next';
import { CategoryMarketplacePage } from '../../components/public/CategoryMarketplacePage';

export const metadata: Metadata = {
  title: 'Restaurants | EthioTravel',
  description:
    'Browse verified restaurants and dining services across Ethiopia.',
};

export default function RestaurantsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return (
    <CategoryMarketplacePage family="RESTAURANT" searchParams={searchParams} />
  );
}
