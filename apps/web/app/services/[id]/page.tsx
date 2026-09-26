import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ArrowLeft, Building2, MapPin } from 'lucide-react';
import { BookingWidget } from '../../../components/bookings/BookingWidget';
import { FavoriteButton } from '../../../components/favorites/FavoriteButton';
import { StartConversationButton } from '../../../components/messaging/StartConversationButton';
import { ReviewPanel } from '../../../components/reviews/ReviewPanel';
import { AddToTripButton } from '../../../components/trips/AddToTripButton';
import { ServiceCategoryDetails } from '../../../components/public/ServiceCategoryDetails';
import { Container } from '../../../components/ui/Container';
import { ApiError, getJson } from '../../../lib/api';
import { publicBusinessPath } from '../../../lib/public-business-route';
import { getPublicServiceCategoryPresentation } from '../../../lib/public-service-category';
import type { Service } from '../../../lib/types';

const uuidV4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function genericPricing(
  service: Service,
  labels: { contact: string; free: string; request: string },
): string {
  if (service.pricingModel === 'FREE') return labels.free;
  if (service.pricingModel === 'CONTACT_FOR_PRICE') return labels.contact;
  if (
    service.price === null ||
    service.price === undefined ||
    !service.currency
  )
    return labels.request;
  return `${service.currency} ${service.price}`;
}

async function publicService(id: string): Promise<Service> {
  if (!uuidV4.test(id)) notFound();
  try {
    return await getJson<Service>(`/services/${id}`);
  } catch (error) {
    if (
      error instanceof ApiError &&
      (error.status === 400 || error.status === 404)
    )
      notFound();
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const servicesT = await getTranslations('services');
  try {
    const service = await publicService((await params).id);
    return {
      title: `${service.name} | EthioTravel`,
      description: service.shortDescription,
    };
  } catch {
    return { title: servicesT('metadataFallback') };
  }
}

export default async function PublicServiceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [marketplaceT, servicesT] = await Promise.all([
    getTranslations('marketplace'),
    getTranslations('services'),
  ]);
  const service = await publicService((await params).id);
  const categoryPresentation = getPublicServiceCategoryPresentation(
    service.category?.family,
  );
  const location = [service.city?.name, service.region?.name]
    .filter(Boolean)
    .join(', ');
  const businessHref = service.business
    ? publicBusinessPath({
        slug: service.business.slug,
        city: service.city,
        region: service.region,
      })
    : null;

  return (
    <main className="bg-slate-50">
      <Container className="py-8 sm:py-10">
        <Link
          href={categoryPresentation?.href ?? '/services'}
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-highland hover:text-highland/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-offset-2"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {marketplaceT('backTo', {
            category:
              service.category?.family === 'ACCOMMODATION'
                ? servicesT('familyAccommodation')
                : service.category?.family === 'RESTAURANT'
                  ? servicesT('familyRestaurant')
                  : service.category?.family === 'TOUR'
                    ? servicesT('familyTour')
                    : service.category?.family === 'TRANSPORT'
                      ? servicesT('familyTransport')
                      : servicesT('title'),
          })}
        </Link>
        <div className="mt-4 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-center gap-2 pr-10">
              {service.category?.name ? (
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                  {service.category.name}
                </span>
              ) : null}
              <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
                {marketplaceT('verifiedListing')}
              </span>
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              {service.name}
            </h1>
            {service.business?.name ? (
              <div className="mt-3 flex items-center gap-2 text-sm text-slate-700">
                <Building2
                  className="h-4 w-4 text-highland"
                  aria-hidden="true"
                />
                {businessHref ? (
                  <Link
                    href={businessHref}
                    className="font-semibold hover:text-highland focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-offset-2"
                  >
                    {service.business.name}
                  </Link>
                ) : (
                  <span className="font-semibold">{service.business.name}</span>
                )}
              </div>
            ) : null}
            {location ? (
              <p className="mt-2 flex items-center gap-2 text-sm text-slate-500">
                <MapPin className="h-4 w-4" aria-hidden="true" />
                {location}
              </p>
            ) : null}
            <p className="mt-6 text-base leading-7 text-slate-700">
              {service.description || service.shortDescription}
            </p>
          </section>
          <aside className="space-y-4">
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm text-slate-500">
                {marketplaceT('servicePrice')}
              </p>
              <p className="mt-1 text-xl font-bold text-slate-950">
                {genericPricing(service, {
                  contact: servicesT('contactForPrice'),
                  free: servicesT('free'),
                  request: servicesT('priceOnRequest'),
                })}
              </p>
            </section>
            <FavoriteButton
              targetType="SERVICE"
              targetId={service.id}
              targetName={service.name}
              className="w-full justify-center rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-highland hover:text-highland"
            />
            <AddToTripButton
              targetType="SERVICE"
              targetId={service.id}
              targetName={service.name}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-highland hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
            />
            {service.business?.id ? (
              <StartConversationButton
                businessId={service.business.id}
                label={marketplaceT('messageBusiness')}
                className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-highland px-4 py-2.5 text-sm font-semibold text-highland transition hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              />
            ) : null}
            <BookingWidget
              serviceId={service.id}
              serviceName={service.name}
              pricingModel={service.pricingModel}
              price={service.price}
              currency={service.currency}
            />
          </aside>
        </div>
        <div className="mt-6 space-y-6">
          <ServiceCategoryDetails service={service} />
          <ReviewPanel targetType="SERVICE" targetId={service.id} />
        </div>
      </Container>
    </main>
  );
}
