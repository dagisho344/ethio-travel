import { Suspense } from 'react';
import { getTranslations } from 'next-intl/server';
import { ExploreClient } from './ExploreClient';
import { Container } from '../ui/Container';
import { SectionHeading } from '../ui/States';
import { safePage } from '../../lib/api';
import { safeDestinationPage } from '../../lib/public-destinations';
import { getRequestLocale } from '../../i18n/server';
import type { Category, LocationSummary } from '../../lib/types';

export async function PublicSearchPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = await getTranslations('discovery');
  const locale = await getRequestLocale();
  const params = await searchParams;
  const regionSlug =
    typeof params.regionSlug === 'string' ? params.regionSlug : '';
  const citySlug = typeof params.citySlug === 'string' ? params.citySlug : '';
  const destinationSlug =
    typeof params.destinationSlug === 'string' ? params.destinationSlug : '';

  const [businessCategories, serviceCategories, regions] = await Promise.all([
    safePage<Category>('/business-categories', { limit: 100 }),
    safePage<Category>('/service-categories', { limit: 100 }),
    safePage<LocationSummary>('/regions', { limit: 100 }),
  ]);

  const selectedRegion = regions?.data.find(
    (region) => region.slug === regionSlug,
  );
  const cities = selectedRegion
    ? await safePage<LocationSummary>(
        `/regions/${selectedRegion.slug}/cities`,
        {
          limit: 100,
        },
      )
    : null;
  const selectedCity = cities?.data.find((city) => city.slug === citySlug);
  const destinations =
    selectedRegion && selectedCity
      ? await safeDestinationPage(
          `/regions/${selectedRegion.slug}/cities/${selectedCity.slug}/destinations`,
          locale,
          { limit: 100 },
        )
      : null;
  const selectedDestination = destinations?.data.find(
    (destination) => destination.slug === destinationSlug,
  );

  return (
    <main className="bg-slate-50">
      <Container className="py-8 sm:py-10">
        <SectionHeading
          eyebrow={t('eyebrow')}
          title={t('title')}
          description={t('description')}
        />
        <Suspense
          fallback={
            <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
              {t('loadingExplorer')}
            </div>
          }
        >
          <ExploreClient
            locale={locale}
            businessCategories={businessCategories?.data ?? []}
            serviceCategories={serviceCategories?.data ?? []}
            regions={regions?.data ?? []}
            cities={selectedRegion ? (cities?.data ?? []) : []}
            destinations={
              selectedRegion && selectedCity
                ? (destinations?.data.map(({ name, slug }) => ({
                    name,
                    slug,
                  })) ?? [])
                : []
            }
            normalizedRegionSlug={selectedRegion?.slug ?? ''}
            normalizedCitySlug={selectedCity?.slug ?? ''}
            normalizedDestinationSlug={selectedDestination?.slug ?? ''}
          />
        </Suspense>
      </Container>
    </main>
  );
}
