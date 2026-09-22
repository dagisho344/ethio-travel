import Link from 'next/link';
import { ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { safePage } from '../../lib/api';
import {
  hasPublicServiceFilters,
  parsePublicServiceFilters,
  publicServiceFilterHref,
} from '../../lib/public-service-filters';
import {
  getPublicServiceCategoryPresentation,
  type PublicServiceCategoryFamily,
} from '../../lib/public-service-category';
import type { Category, LocationSummary, Service } from '../../lib/types';
import { CategoryServiceFilters } from './CategoryServiceFilters';
import { PublicServiceCard } from './PublicServiceCard';
import { Container } from '../ui/Container';
import { SectionHeading } from '../ui/States';

type SearchParameters = Record<string, string | string[] | undefined>;

export async function CategoryMarketplacePage({
  family,
  searchParams,
}: {
  family: Exclude<PublicServiceCategoryFamily, 'OTHER'>;
  searchParams: Promise<SearchParameters>;
}) {
  const presentation = getPublicServiceCategoryPresentation(family);
  if (!presentation) return null;

  const filters = parsePublicServiceFilters(await searchParams, family);
  const page = filters.page ? Number(filters.page) : 1;
  const [
    regionsResponse,
    citiesResponse,
    categoriesResponse,
    originCitiesResponse,
    destinationCitiesResponse,
  ] = await Promise.all([
    safePage<LocationSummary>('/regions', { limit: 100 }),
    filters.regionSlug
      ? safePage<LocationSummary>(
          `/regions/${encodeURIComponent(filters.regionSlug)}/cities`,
          { limit: 100 },
        )
      : Promise.resolve(null),
    safePage<Category>('/service-categories', { family, limit: 100 }),
    family === 'TRANSPORT' && filters.originRegionSlug
      ? safePage<LocationSummary>(
          `/regions/${encodeURIComponent(filters.originRegionSlug)}/cities`,
          { limit: 100 },
        )
      : Promise.resolve(null),
    family === 'TRANSPORT' && filters.destinationRegionSlug
      ? safePage<LocationSummary>(
          `/regions/${encodeURIComponent(filters.destinationRegionSlug)}/cities`,
          { limit: 100 },
        )
      : Promise.resolve(null),
  ]);

  const response = await safePage<Service>('/services', {
    ...filters,
    family,
    page,
    limit: 12,
  });
  const services = response?.data ?? [];
  const hasFilters = hasPublicServiceFilters(filters, true);

  return (
    <main className="bg-slate-50">
      <Container className="py-10 sm:py-12">
        <SectionHeading
          eyebrow="EXPLORE ETHIOTRAVEL"
          title={presentation.label}
          description={presentation.description}
        />
        <CategoryServiceFilters
          basePath={presentation.href}
          categories={categoriesResponse?.data ?? []}
          cities={citiesResponse?.data ?? []}
          destinationCities={destinationCitiesResponse?.data ?? []}
          family={family}
          filters={filters}
          originCities={originCitiesResponse?.data ?? []}
          regions={regionsResponse?.data ?? []}
        />
        {!response ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-6 py-5 text-sm text-amber-900">
            We could not load {presentation.label.toLowerCase()} right now.
            Please try again soon.
          </div>
        ) : services.length ? (
          <>
            <p className="mb-5 text-sm text-slate-600">
              {response.meta.total} result
              {response.meta.total === 1 ? '' : 's'} from verified businesses
            </p>
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {services.map((service) => (
                <PublicServiceCard key={service.id} service={service} />
              ))}
            </div>
            {response.meta.totalPages > 1 ? (
              <nav
                className="mt-8 flex items-center justify-between gap-3"
                aria-label={`${presentation.label} pagination`}
              >
                {response.meta.page > 1 ? (
                  <Link
                    href={publicServiceFilterHref(
                      presentation.href,
                      filters,
                      response.meta.page - 1,
                      true,
                    )}
                    className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-highland hover:text-highland focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-offset-2"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    Previous
                  </Link>
                ) : (
                  <span />
                )}
                <p className="text-sm text-slate-600">
                  Page {response.meta.page} of {response.meta.totalPages}
                </p>
                {response.meta.page < response.meta.totalPages ? (
                  <Link
                    href={publicServiceFilterHref(
                      presentation.href,
                      filters,
                      response.meta.page + 1,
                      true,
                    )}
                    className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-highland hover:text-highland focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-offset-2"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            ) : null}
          </>
        ) : (
          <section className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
            <Sparkles
              className="mx-auto h-8 w-8 text-highland"
              aria-hidden="true"
            />
            <h2 className="mt-4 text-lg font-semibold text-slate-950">
              {hasFilters
                ? 'No services match your current filters'
                : `No ${presentation.label.toLowerCase()} available yet`}
            </h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">
              {hasFilters
                ? 'Try adjusting or clearing your filters.'
                : 'Verified services in this category will appear here when they are published.'}
            </p>
            {hasFilters ? (
              <Link
                href={presentation.href}
                className="mt-5 inline-flex min-h-11 items-center rounded-md bg-highland px-4 py-2 text-sm font-semibold text-white transition hover:bg-highland/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-offset-2"
              >
                Clear filters
              </Link>
            ) : null}
          </section>
        )}
      </Container>
    </main>
  );
}
