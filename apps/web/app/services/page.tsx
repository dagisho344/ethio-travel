import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  ImageIcon,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { ServiceFilters } from './ServiceFilters';
import { Container } from '../../components/ui/Container';
import { SectionHeading } from '../../components/ui/States';
import { safePage } from '../../lib/api';
import { formatPricing } from '../../lib/format';
import type {
  Category,
  LocationSummary,
  PricingModel,
  Service,
} from '../../lib/types';

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

const pricingModels: PricingModel[] = [
  'FREE',
  'CONTACT_FOR_PRICE',
  'FIXED',
  'PER_PERSON',
  'PER_NIGHT',
  'PER_HOUR',
  'PER_DAY',
  'STARTING_FROM',
];

function pick(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function validMoneyFilter(value?: string): string | undefined {
  if (!value) return undefined;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? String(amount) : undefined;
}

function servicePath(service: Service) {
  if (service.region?.slug && service.city?.slug && service.business?.slug) {
    return `/explore?types=service&regionSlug=${encodeURIComponent(service.region.slug)}&citySlug=${encodeURIComponent(service.city.slug)}&q=${encodeURIComponent(service.name)}`;
  }
  return '/explore?types=service';
}

function pricingLabel(model?: PricingModel) {
  if (!model) return undefined;
  const labels: Record<PricingModel, string> = {
    FREE: 'Free',
    CONTACT_FOR_PRICE: 'Contact for price',
    FIXED: 'Fixed price',
    PER_PERSON: 'Per person',
    PER_NIGHT: 'Per night',
    PER_HOUR: 'Per hour',
    PER_DAY: 'Per day',
    STARTING_FROM: 'Starting from',
  };
  return labels[model];
}

function ServiceResultCard({ service }: { service: Service }) {
  const location = [service.city?.name, service.region?.name]
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
          {service.category?.name ? (
            <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
              {service.category.name}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Published
          </span>
        </div>
        <h3 className="mt-3 text-lg font-bold text-slate-950">
          {service.name}
        </h3>
        {service.business?.name ? (
          <p className="mt-1 text-sm font-medium text-slate-700">
            {service.business.name}
          </p>
        ) : null}
        {location ? (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-slate-500">
            <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{location}</span>
          </p>
        ) : null}
        {service.destination?.name ? (
          <p className="mt-2 text-sm text-slate-500">
            Near {service.destination.name}
          </p>
        ) : null}
        {service.shortDescription ? (
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
            {service.shortDescription}
          </p>
        ) : (
          <p className="mt-3 text-sm leading-6 text-slate-500">
            More service details will be added soon.
          </p>
        )}
        <div className="mt-4 rounded-md bg-slate-50 px-3 py-2 text-sm">
          <p className="font-semibold text-slate-950">
            {formatPricing(
              service.pricingModel,
              service.price,
              service.currency,
            )}
          </p>
          {pricingLabel(service.pricingModel) ? (
            <p className="mt-1 text-xs text-slate-500">
              {pricingLabel(service.pricingModel)}
            </p>
          ) : null}
        </div>
        <Link
          className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-highland transition hover:text-highland/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-offset-2"
          href={servicePath(service)}
        >
          View service
          <ArrowRight
            className="h-4 w-4 transition group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      </div>
    </article>
  );
}

function EmptyServices({ hasFilters }: { hasFilters: boolean }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-highland">
        <Sparkles className="h-6 w-6" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-base font-semibold text-slate-950">
        {hasFilters
          ? 'No matching services'
          : 'No published services available yet.'}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-600">
        {hasFilters
          ? 'Try adjusting your search or filters.'
          : 'Services from verified local businesses will appear here.'}
      </p>
    </div>
  );
}

function ErrorServices() {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-6 py-5 text-sm text-amber-900">
      We could not load services right now. Please try again soon.
    </div>
  );
}

export default async function ServicesPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = pick(params.q)?.trim();
  const regionSlug = pick(params.regionSlug)?.trim();
  const citySlug = pick(params.citySlug)?.trim();
  const category = pick(params.category)?.trim();
  const pricingModel = pick(params.pricingModel) as PricingModel | undefined;
  const minPrice = validMoneyFilter(pick(params.minPrice));
  const maxPrice = validMoneyFilter(pick(params.maxPrice));
  const page = pick(params.page) ?? '1';

  const [regionsResponse, citiesResponse, categoriesResponse] =
    await Promise.all([
      safePage<LocationSummary>('/regions', { limit: 100 }),
      regionSlug
        ? safePage<LocationSummary>(`/regions/${regionSlug}/cities`, {
            limit: 100,
          })
        : Promise.resolve(null),
      safePage<Category>('/service-categories', { limit: 100 }),
    ]);

  const regions = regionsResponse?.data ?? [];
  const cities = citiesResponse?.data ?? [];
  const categories = categoriesResponse?.data ?? [];
  const selectedRegion = regions.find((region) => region.slug === regionSlug);
  const selectedCitySlug = selectedRegion ? citySlug : undefined;
  const selectedCategory = categories.find((item) => item.code === category);
  const selectedPricingModel = pricingModels.includes(
    pricingModel as PricingModel,
  )
    ? pricingModel
    : undefined;

  const servicesResponse = await safePage<Service>('/services', {
    q,
    regionSlug: selectedRegion?.slug,
    citySlug: selectedCitySlug,
    category: selectedCategory?.code,
    pricingModel: selectedPricingModel,
    minPrice,
    maxPrice,
    page,
    limit: 9,
  });

  const hasFilters = Boolean(
    q ||
    selectedRegion ||
    selectedCitySlug ||
    selectedCategory ||
    selectedPricingModel ||
    minPrice ||
    maxPrice,
  );
  const services = servicesResponse?.data ?? [];

  return (
    <main className="bg-slate-50">
      <Container className="py-10 sm:py-12">
        <SectionHeading
          eyebrow="SERVICES"
          title="Published Services"
          description="Browse available travel experiences and services from verified local businesses."
        />

        <ServiceFilters
          q={q ?? ''}
          regionSlug={selectedRegion?.slug ?? ''}
          citySlug={selectedCitySlug ?? ''}
          category={selectedCategory?.code ?? ''}
          pricingModel={selectedPricingModel ?? ''}
          minPrice={minPrice ?? ''}
          maxPrice={maxPrice ?? ''}
          regions={regions}
          cities={cities}
          categories={categories}
        />

        {!servicesResponse ? (
          <ErrorServices />
        ) : services.length ? (
          <>
            <div className="mb-4 flex items-center justify-between gap-4 text-sm text-slate-600">
              <p>
                {servicesResponse.meta.total} service
                {servicesResponse.meta.total === 1 ? '' : 's'} found
              </p>
              <p>
                Page {servicesResponse.meta.page} of{' '}
                {Math.max(servicesResponse.meta.totalPages, 1)}
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {services.map((service) => (
                <ServiceResultCard key={service.id} service={service} />
              ))}
            </div>
          </>
        ) : (
          <EmptyServices hasFilters={hasFilters} />
        )}
      </Container>
    </main>
  );
}
