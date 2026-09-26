import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import {
  ArrowRight,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  ImageIcon,
  MapPin,
  Sparkles,
} from 'lucide-react';
import { ServiceFilters } from './ServiceFilters';
import { BookingWidget } from '../../components/bookings/BookingWidget';
import { FavoriteButton } from '../../components/favorites/FavoriteButton';
import { Container } from '../../components/ui/Container';
import { SectionHeading } from '../../components/ui/States';
import { safePage } from '../../lib/api';
import { publicServiceFilterHref } from '../../lib/public-service-filters';
import {
  favoriteLookupKey,
  getInitialFavoriteLookup,
} from '../../lib/favorites';
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
  return `/services/${service.id}`;
}

function ServiceResultCard({
  service,
  favoriteId,
  labels,
}: {
  service: Service;
  favoriteId?: string;
  labels: {
    moreDetails: string;
    near: (values: { destination: string }) => string;
    pricing: (model?: PricingModel) => string | undefined;
    published: string;
    view: string;
  };
}) {
  const location = [service.city?.name, service.region?.name]
    .filter(Boolean)
    .join(', ');

  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-highland/30 hover:shadow-md">
      <FavoriteButton
        targetType="SERVICE"
        targetId={service.id}
        targetName={service.name}
        initialFavoriteId={favoriteId}
        className="absolute right-3 top-3 z-10"
      />
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
            {labels.published}
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
            {labels.near({ destination: service.destination.name })}
          </p>
        ) : null}
        {service.shortDescription ? (
          <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-600">
            {service.shortDescription}
          </p>
        ) : (
          <p className="mt-3 text-sm leading-6 text-slate-500">
            {labels.moreDetails}
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
          {labels.pricing(service.pricingModel) ? (
            <p className="mt-1 text-xs text-slate-500">
              {labels.pricing(service.pricingModel)}
            </p>
          ) : null}
        </div>
        <Link
          className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-highland transition hover:text-highland/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-offset-2"
          href={servicePath(service)}
        >
          {labels.view}
          <ArrowRight
            className="h-4 w-4 transition group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
        <BookingWidget
          serviceId={service.id}
          serviceName={service.name}
          pricingModel={service.pricingModel}
          price={service.price}
          currency={service.currency}
          compact
        />
      </div>
    </article>
  );
}

function EmptyServices({
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
        <Sparkles className="h-6 w-6" aria-hidden="true" />
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

function ErrorServices({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 px-6 py-5 text-sm text-amber-900">
      {message}
    </div>
  );
}

export default async function ServicesPage({ searchParams }: PageProps) {
  const [t, discoveryT, marketplaceT] = await Promise.all([
    getTranslations('services'),
    getTranslations('discovery'),
    getTranslations('marketplace'),
  ]);
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

  const [servicesResponse, favoriteLookup] = await Promise.all([
    safePage<Service>('/services', {
      q,
      regionSlug: selectedRegion?.slug,
      citySlug: selectedCitySlug,
      category: selectedCategory?.code,
      pricingModel: selectedPricingModel,
      minPrice,
      maxPrice,
      page,
      limit: 9,
    }),
    getInitialFavoriteLookup('SERVICE'),
  ]);

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
          eyebrow={t('eyebrow')}
          title={t('title')}
          description={t('description')}
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
          <ErrorServices message={t('loadError')} />
        ) : services.length ? (
          <>
            <div className="mb-4 flex items-center justify-between gap-4 text-sm text-slate-600">
              <p>{t('serviceCount', { count: servicesResponse.meta.total })}</p>
              <p>
                {discoveryT('pageOf', {
                  page: servicesResponse.meta.page,
                  total: Math.max(servicesResponse.meta.totalPages, 1),
                })}
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {services.map((service) => (
                <ServiceResultCard
                  key={service.id}
                  service={service}
                  labels={{
                    moreDetails: marketplaceT('moreServiceDetails'),
                    near: (values) => marketplaceT('nearDestination', values),
                    pricing: (model) => {
                      if (!model) return undefined;
                      const pricingLabels: Record<PricingModel, string> = {
                        CONTACT_FOR_PRICE: t('contactForPrice'),
                        FIXED: discoveryT('fixedPrice'),
                        FREE: t('free'),
                        PER_DAY: discoveryT('perDay'),
                        PER_HOUR: discoveryT('perHour'),
                        PER_NIGHT: discoveryT('perNight'),
                        PER_PERSON: discoveryT('perPerson'),
                        STARTING_FROM: discoveryT('startingFrom'),
                      };
                      return pricingLabels[model];
                    },
                    published: marketplaceT('verifiedListing'),
                    view: marketplaceT('viewService'),
                  }}
                  favoriteId={
                    favoriteLookup[favoriteLookupKey('SERVICE', service.id)]
                  }
                />
              ))}
            </div>
            {servicesResponse.meta.totalPages > 1 ? (
              <nav
                className="mt-8 flex items-center justify-between gap-3"
                aria-label={marketplaceT('pagePagination', {
                  category: t('title'),
                })}
              >
                {servicesResponse.meta.page > 1 ? (
                  <Link
                    href={publicServiceFilterHref(
                      '/services',
                      {
                        q,
                        regionSlug: selectedRegion?.slug,
                        citySlug: selectedCitySlug,
                        category: selectedCategory?.code,
                        pricingModel: selectedPricingModel,
                        minPrice,
                        maxPrice,
                      },
                      servicesResponse.meta.page - 1,
                    )}
                    className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-highland hover:text-highland focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-offset-2"
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    {t('previous')}
                  </Link>
                ) : (
                  <span />
                )}
                <p className="text-sm text-slate-600">
                  {t('pageOf', {
                    page: servicesResponse.meta.page,
                    total: servicesResponse.meta.totalPages,
                  })}
                </p>
                {servicesResponse.meta.page <
                servicesResponse.meta.totalPages ? (
                  <Link
                    href={publicServiceFilterHref(
                      '/services',
                      {
                        q,
                        regionSlug: selectedRegion?.slug,
                        citySlug: selectedCitySlug,
                        category: selectedCategory?.code,
                        pricingModel: selectedPricingModel,
                        minPrice,
                        maxPrice,
                      },
                      servicesResponse.meta.page + 1,
                    )}
                    className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-highland hover:text-highland focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-offset-2"
                  >
                    {t('next')}
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                ) : (
                  <span />
                )}
              </nav>
            ) : null}
          </>
        ) : (
          <>
            <EmptyServices
              hasFilters={hasFilters}
              labels={{
                noAvailableMessage: t('noAvailableMessage'),
                noAvailableTitle: t('noAvailableTitle'),
                noMatchingMessage: t('noMatchingMessage'),
                noMatchingTitle: t('noMatchingTitle'),
              }}
            />
            {hasFilters ? (
              <Link
                href="/services"
                className="mt-4 inline-flex min-h-11 items-center rounded-md bg-highland px-4 py-2 text-sm font-semibold text-white transition hover:bg-highland/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-offset-2"
              >
                {t('clear')}
              </Link>
            ) : null}
          </>
        )}
      </Container>
    </main>
  );
}
