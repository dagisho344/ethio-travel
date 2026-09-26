import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { CategoryMarketplacePage } from '../../components/public/CategoryMarketplacePage';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('services');
  return {
    title: `${t('familyAccommodation')} | EthioTravel`,
    description: t('familyAccommodationDescription'),
  };
}

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
