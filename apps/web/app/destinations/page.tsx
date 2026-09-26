import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { ArrowRight, ImageIcon, Map, MapPin } from 'lucide-react';
import { DestinationFilters } from './DestinationFilters';
import { FavoriteButton } from '../../components/favorites/FavoriteButton';
import { AddToTripButton } from '../../components/trips/AddToTripButton';
import { Container } from '../../components/ui/Container';
import { SectionHeading } from '../../components/ui/States';
import { safePage } from '../../lib/api';
import {
  favoriteLookupKey,
  getInitialFavoriteLookup,
} from '../../lib/favorites';
import type {
  Destination,
  LocationSummary,
  PaginatedResponse,
} from '../../lib/types';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function pick(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function destinationPath(
  regionSlug?: string,
  citySlug?: string,
  slug?: string,
) {
  if (regionSlug && citySlug && slug) {
    return `/regions/${encodeURIComponent(regionSlug)}/cities/${encodeURIComponent(citySlug)}/destinations/${encodeURIComponent(slug)}`;
  }
  return '/search?types=destination';
}

function pageNumber(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
}

function withLocation(
  destination: Destination,
  city?: LocationSummary,
  region?: LocationSummary,
): Destination {
  return {
    ...destination,
    city: destination.city ?? city,
    region: destination.region ?? region,
  };
}

async function findDestinations({
  q,
  page,
  region,
  cities,
  citySlug,
}: {
  q?: string;
  page: string;
  region?: LocationSummary;
  cities: LocationSummary[];
  citySlug?: string;
}): Promise<PaginatedResponse<Destination> | null> {
  const limit = 9;
  const currentPage = pageNumber(page);

  if (region && citySlug) {
    const city = cities.find((item) => item.slug === citySlug);
    const response = await safePage<Destination>(
      `/regions/${region.slug}/cities/${citySlug}/destinations`,
      { q, page, limit },
    );
    return response
      ? {
          ...response,
          data: response.data.map((destination) =>
            withLocation(destination, city, region),
          ),
        }
      : null;
  }

  if (region) {
    const responses = await Promise.all(
      cities.map(async (city) => {
        const response = await safePage<Destination>(
          `/regions/${region.slug}/cities/${city.slug}/destinations`,
          { q, page: 1, limit: 100 },
        );
        return (
          response?.data.map((destination) =>
            withLocation(destination, city, region),
          ) ?? []
        );
      }),
    );
    const data = responses.flat().sort((a, b) => a.name.localeCompare(b.name));
    const start = (currentPage - 1) * limit;
    return {
      data: data.slice(start, start + limit),
      meta: {
        page: currentPage,
        limit,
        total: data.length,
        totalPages: Math.ceil(data.length / limit),
      },
    };
  }

  return safePage<Destination>('/destinations', { q, page, limit });
}

function DestinationResultCard({
  destination,
  favoriteId,
  labels,
}: {
  destination: Destination;
  favoriteId?: string;
  labels: { moreDetails: string; viewDestination: string };
}) {
  const region = destination.region;
  const city = destination.city;
  const location = [city?.name, region?.name].filter(Boolean).join(', ');

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-highland/30 hover:shadow-md">
      <FavoriteButton
        targetType="DESTINATION"
        targetId={destination.id}
        targetName={destination.name}
        initialFavoriteId={favoriteId}
        className="absolute right-3 top-3 z-10"
      />
      <div className="flex h-36 items-center justify-center bg-gradient-to-br from-emerald-50 via-sky-50 to-amber-50 text-highland">
        <div className="rounded-full bg-white/75 p-4 shadow-sm ring-1 ring-slate-200/70">
          <ImageIcon className="h-7 w-7" aria-hidden="true" />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-bold text-slate-950">{destination.name}</h3>
        {location ? (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{location}</span>
          </p>
        ) : null}
        {destination.shortDescription ? (
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
            {destination.shortDescription}
          </p>
        ) : (
          <p className="mt-3 text-sm leading-6 text-slate-500">
            {labels.moreDetails}
          </p>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Link
            className="inline-flex items-center gap-2 text-sm font-semibold text-highland transition hover:text-highland/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-offset-2"
            href={destinationPath(region?.slug, city?.slug, destination.slug)}
          >
            {labels.viewDestination}
            <ArrowRight
              className="h-4 w-4 transition group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </Link>
          <AddToTripButton
            targetType="DESTINATION"
            targetId={destination.id}
            targetName={destination.name}
          />
        </div>
      </div>
    </article>
  );
}

function EmptyDestinations({
  hasFilters,
  labels,
}: {
  hasFilters: boolean;
  labels: {
    noAvailableMessage: string;
    noAvailableTitle: string;
    noMatchingMessage: string;
    noMatchingTitle: string;
  };
}) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-highland">
        <Map className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-950">
        {hasFilters ? labels.noMatchingTitle : labels.noAvailableTitle}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
        {hasFilters ? labels.noMatchingMessage : labels.noAvailableMessage}
      </p>
    </div>
  );
}

function ErrorDestinations({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-6 py-5 text-sm text-amber-900">
      {message}
    </div>
  );
}

export default async function DestinationsPage({ searchParams }: PageProps) {
  const [t, discoveryT, marketplaceT] = await Promise.all([
    getTranslations('destinations'),
    getTranslations('discovery'),
    getTranslations('marketplace'),
  ]);
  const params = await searchParams;
  const q = pick(params.q)?.trim();
  const regionSlug = pick(params.regionSlug)?.trim();
  const citySlug = pick(params.citySlug)?.trim();
  const page = pick(params.page) ?? '1';

  const [regionsResponse, citiesResponse] = await Promise.all([
    safePage<LocationSummary>('/regions', { limit: 100 }),
    regionSlug
      ? safePage<LocationSummary>(`/regions/${regionSlug}/cities`, {
          limit: 100,
        })
      : Promise.resolve(null),
  ]);
  const regions = regionsResponse?.data ?? [];
  const cities = citiesResponse?.data ?? [];
  const selectedRegion = regions.find((region) => region.slug === regionSlug);
  const selectedCitySlug = selectedRegion ? citySlug : undefined;

  const [destinationsResponse, favoriteLookup] = await Promise.all([
    findDestinations({
      q,
      page,
      region: selectedRegion,
      cities,
      citySlug: selectedCitySlug,
    }),
    getInitialFavoriteLookup('DESTINATION'),
  ]);

  const hasFilters = Boolean(q || selectedRegion || selectedCitySlug);
  const destinations = destinationsResponse?.data ?? [];

  return (
    <main className="bg-slate-50">
      <Container className="py-10 sm:py-12">
        <SectionHeading
          eyebrow={t('eyebrow')}
          title={t('title')}
          description={t('description')}
        />

        <DestinationFilters
          q={q ?? ''}
          regionSlug={selectedRegion?.slug ?? ''}
          citySlug={selectedCitySlug ?? ''}
          regions={regions}
          cities={cities}
        />

        {!destinationsResponse ? (
          <ErrorDestinations message={t('loadError')} />
        ) : destinations.length ? (
          <>
            <div className="mb-4 flex items-center justify-between gap-4 text-sm text-slate-600">
              <p>
                {t('destinationCount', {
                  count: destinationsResponse.meta.total,
                })}
              </p>
              <p>
                {discoveryT('pageOf', {
                  page: destinationsResponse.meta.page,
                  total: Math.max(destinationsResponse.meta.totalPages, 1),
                })}
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {destinations.map((destination) => (
                <DestinationResultCard
                  key={destination.id}
                  destination={destination}
                  labels={{
                    moreDetails: marketplaceT('moreDestinationDetails'),
                    viewDestination: marketplaceT('viewDestination'),
                  }}
                  favoriteId={
                    favoriteLookup[
                      favoriteLookupKey('DESTINATION', destination.id)
                    ]
                  }
                />
              ))}
            </div>
          </>
        ) : (
          <EmptyDestinations
            hasFilters={hasFilters}
            labels={{
              noAvailableMessage: t('noAvailableMessage'),
              noAvailableTitle: t('noAvailableTitle'),
              noMatchingMessage: t('noMatchingMessage'),
              noMatchingTitle: t('noMatchingTitle'),
            }}
          />
        )}
      </Container>
    </main>
  );
}
