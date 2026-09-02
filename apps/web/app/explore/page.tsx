import { Suspense } from 'react';
import { ExploreClient } from '../../components/explore/ExploreClient';
import { Container } from '../../components/ui/Container';
import { SectionHeading } from '../../components/ui/States';
import { safePage } from '../../lib/api';
import type { Category, Destination, LocationSummary } from '../../lib/types';

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
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
      ? await safePage<Destination>(
          `/regions/${selectedRegion.slug}/cities/${selectedCity.slug}/destinations`,
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
          eyebrow="Explore"
          title="Find Places, Businesses and Services"
          description="Search across public destinations, attractions, verified businesses and published services."
        />
        <Suspense
          fallback={
            <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
              Loading explorer...
            </div>
          }
        >
          <ExploreClient
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
