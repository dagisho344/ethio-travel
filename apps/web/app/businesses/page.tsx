import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  ImageIcon,
  MapPin,
} from 'lucide-react';
import { BusinessFilters } from './BusinessFilters';
import { Container } from '../../components/ui/Container';
import { SectionHeading } from '../../components/ui/States';
import { safePage } from '../../lib/api';
import type { Business, Category, LocationSummary } from '../../lib/types';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function pick(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function businessPath(business: Business) {
  if (business.region?.slug && business.city?.slug && business.slug) {
    return `/explore?types=business&regionSlug=${encodeURIComponent(business.region.slug)}&citySlug=${encodeURIComponent(business.city.slug)}&q=${encodeURIComponent(business.name)}`;
  }
  return '/explore?types=business';
}

function BusinessResultCard({ business }: { business: Business }) {
  const location = [business.city?.name, business.region?.name]
    .filter(Boolean)
    .join(', ');

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-highland/30 hover:shadow-md">
      <div className="flex h-32 items-center justify-center bg-gradient-to-br from-emerald-50 via-sky-50 to-amber-50 text-highland">
        <div className="rounded-full bg-white/75 p-4 shadow-sm ring-1 ring-slate-200/70">
          <ImageIcon className="h-7 w-7" aria-hidden="true" />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          {business.category?.name ? (
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
              {business.category.name}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Verified
          </span>
        </div>
        <h3 className="mt-3 text-lg font-bold text-slate-950">
          {business.name}
        </h3>
        {location ? (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{location}</span>
          </p>
        ) : null}
        {business.destination?.name ? (
          <p className="mt-2 text-sm text-slate-500">
            Near {business.destination.name}
          </p>
        ) : null}
        {business.description ? (
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
            {business.description}
          </p>
        ) : (
          <p className="mt-3 text-sm leading-6 text-slate-500">
            More business details will be added soon.
          </p>
        )}
        <Link
          className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-highland transition hover:text-highland/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-offset-2"
          href={businessPath(business)}
        >
          View business
          <ArrowRight
            className="h-4 w-4 transition group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      </div>
    </article>
  );
}

function EmptyBusinesses({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-highland">
        <Building2 className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-950">
        {hasFilters
          ? 'No matching businesses'
          : 'No verified businesses available yet'}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
        {hasFilters
          ? 'Try changing your search, location or category filters.'
          : 'Verified local businesses will appear here as they join EthioTravel.'}
      </p>
    </div>
  );
}

function ErrorBusinesses() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-6 py-5 text-sm text-amber-900">
      We could not load businesses right now. Please try again soon.
    </div>
  );
}

export default async function BusinessesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = pick(params.q)?.trim();
  const regionSlug = pick(params.regionSlug)?.trim();
  const citySlug = pick(params.citySlug)?.trim();
  const category = pick(params.category)?.trim();
  const page = pick(params.page) ?? '1';

  const [regionsResponse, citiesResponse, categoriesResponse] =
    await Promise.all([
      safePage<LocationSummary>('/regions', { limit: 100 }),
      regionSlug
        ? safePage<LocationSummary>(`/regions/${regionSlug}/cities`, {
            limit: 100,
          })
        : Promise.resolve(null),
      safePage<Category>('/business-categories', { limit: 100 }),
    ]);

  const regions = regionsResponse?.data ?? [];
  const cities = citiesResponse?.data ?? [];
  const categories = categoriesResponse?.data ?? [];
  const selectedRegion = regions.find((region) => region.slug === regionSlug);
  const selectedCitySlug = selectedRegion ? citySlug : undefined;
  const selectedCategory = categories.find((item) => item.code === category);

  const businessesResponse = await safePage<Business>('/businesses', {
    q,
    regionSlug: selectedRegion?.slug,
    citySlug: selectedCitySlug,
    category: selectedCategory?.code,
    page,
    limit: 9,
  });

  const hasFilters = Boolean(
    q || selectedRegion || selectedCitySlug || selectedCategory,
  );
  const businesses = businessesResponse?.data ?? [];

  return (
    <main className="bg-slate-50">
      <Container className="py-10 sm:py-12">
        <SectionHeading
          eyebrow="Businesses"
          title="Verified Businesses"
          description="Find trusted local businesses that are ready to welcome travelers across Ethiopia."
        />

        <BusinessFilters
          q={q ?? ''}
          regionSlug={selectedRegion?.slug ?? ''}
          citySlug={selectedCitySlug ?? ''}
          category={selectedCategory?.code ?? ''}
          regions={regions}
          cities={cities}
          categories={categories}
        />

        {!businessesResponse ? (
          <ErrorBusinesses />
        ) : businesses.length ? (
          <>
            <div className="mb-4 flex items-center justify-between gap-4 text-sm text-slate-600">
              <p>
                {businessesResponse.meta.total} business
                {businessesResponse.meta.total === 1 ? '' : 'es'} found
              </p>
              <p>
                Page {businessesResponse.meta.page} of{' '}
                {Math.max(businessesResponse.meta.totalPages, 1)}
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {businesses.map((business) => (
                <BusinessResultCard key={business.id} business={business} />
              ))}
            </div>
          </>
        ) : (
          <EmptyBusinesses hasFilters={hasFilters} />
        )}
      </Container>
    </main>
  );
}
