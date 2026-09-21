import type { Metadata } from 'next';
import { CategoryMarketplacePage } from '../../components/public/CategoryMarketplacePage';

export const metadata: Metadata = {
  title: 'Tours | EthioTravel',
  description:
    'Browse verified guided tours and local experiences across Ethiopia.',
};

export default function ToursPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return <CategoryMarketplacePage family="TOUR" searchParams={searchParams} />;
}
