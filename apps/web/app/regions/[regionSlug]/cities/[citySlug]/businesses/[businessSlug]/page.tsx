import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink, Mail, MapPin, Phone } from 'lucide-react';
import { FavoriteButton } from '../../../../../../../components/favorites/FavoriteButton';
import { StartConversationButton } from '../../../../../../../components/messaging/StartConversationButton';
import {
  PublicBusinessCover,
  PublicBusinessGallery,
  PublicBusinessLogo,
} from '../../../../../../../components/public/PublicBusinessMedia';
import { PublicServiceCard } from '../../../../../../../components/public/PublicServiceCard';
import { ReviewPanel } from '../../../../../../../components/reviews/ReviewPanel';
import { AddToTripButton } from '../../../../../../../components/trips/AddToTripButton';
import { Container } from '../../../../../../../components/ui/Container';
import { ApiError, getJson, safePage } from '../../../../../../../lib/api';
import type { Business, Service } from '../../../../../../../lib/types';

type PublicBusinessRouteParams = {
  regionSlug: string;
  citySlug: string;
  businessSlug: string;
};

function publicBusinessApiPath({
  regionSlug,
  citySlug,
  businessSlug,
}: PublicBusinessRouteParams): string {
  return `/regions/${encodeURIComponent(regionSlug)}/cities/${encodeURIComponent(citySlug)}/businesses/${encodeURIComponent(businessSlug)}`;
}

async function publicBusiness(
  route: PublicBusinessRouteParams,
): Promise<Business> {
  try {
    return await getJson<Business>(publicBusinessApiPath(route));
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) notFound();
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PublicBusinessRouteParams>;
}): Promise<Metadata> {
  const businessesT = await getTranslations('businesses');
  try {
    const business = await publicBusiness(await params);
    return {
      title: `${business.name} | EthioTravel`,
      description: business.description,
    };
  } catch {
    return { title: businessesT('metadataFallback') };
  }
}

export default async function PublicBusinessDetailPage({
  params,
}: {
  params: Promise<PublicBusinessRouteParams>;
}) {
  const [businessesT, marketplaceT] = await Promise.all([
    getTranslations('businesses'),
    getTranslations('marketplace'),
  ]);
  const route = await params;
  const business = await publicBusiness(route);
  const services = await safePage<Service>(
    `${publicBusinessApiPath(route)}/services`,
    { limit: 12 },
  );
  const location = [business.city?.name, business.region?.name]
    .filter(Boolean)
    .join(', ');
  return (
    <main className="bg-slate-50">
      <Container className="py-8 sm:py-10">
        <Link
          href="/businesses"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-highland hover:text-highland/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-offset-2"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {businessesT('back')}
        </Link>
        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <PublicBusinessCover
            businessName={business.name}
            media={business.media?.hero}
          />
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
              {marketplaceT('verifiedBusiness')}
            </span>
            {business.category?.name ? (
              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                {business.category.name}
              </span>
            ) : null}
          </div>
          <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
            <div className="flex min-w-0 items-start gap-4">
              <PublicBusinessLogo
                businessName={business.name}
                media={business.media?.logo}
              />
              <div>
                <h1 className="text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
                  {business.name}
                </h1>
                {location ? (
                  <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                    <MapPin className="h-4 w-4" aria-hidden="true" />
                    {location}
                  </p>
                ) : null}
              </div>
            </div>
            <FavoriteButton
              targetType="BUSINESS"
              targetId={business.id}
              targetName={business.name}
              className="shrink-0 rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-highland hover:text-highland"
            />
          </div>
          <p className="mt-6 max-w-3xl text-base leading-7 text-slate-700">
            {business.description}
          </p>
          <div className="mt-6 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <StartConversationButton
              businessId={business.id}
              label={marketplaceT('messageBusiness')}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-highland px-3 font-semibold text-highland hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            />
            <AddToTripButton
              targetType="BUSINESS"
              targetId={business.id}
              targetName={business.name}
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:border-highland hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
            />
            {business.phone ? (
              <a
                href={`tel:${business.phone}`}
                className="flex min-h-11 items-center gap-2 rounded-md bg-slate-50 px-3 font-semibold text-slate-700 hover:text-highland focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-offset-2"
              >
                <Phone className="h-4 w-4" aria-hidden="true" />
                {business.phone}
              </a>
            ) : null}
            {business.email ? (
              <a
                href={`mailto:${business.email}`}
                className="flex min-h-11 items-center gap-2 rounded-md bg-slate-50 px-3 font-semibold text-slate-700 hover:text-highland focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-offset-2"
              >
                <Mail className="h-4 w-4" aria-hidden="true" />
                {business.email}
              </a>
            ) : null}
            {business.website ? (
              <a
                href={business.website}
                className="flex min-h-11 items-center gap-2 rounded-md bg-slate-50 px-3 font-semibold text-slate-700 hover:text-highland focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-offset-2"
                target="_blank"
                rel="noreferrer"
              >
                {marketplaceT('website')}
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            ) : null}
          </div>
        </section>
        <PublicBusinessGallery
          businessName={business.name}
          media={business.media?.gallery}
        />
        <section className="mt-8">
          <h2 className="text-2xl font-bold text-slate-950">
            {marketplaceT('publishedServices')}
          </h2>
          {!services ? (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {marketplaceT('servicesLoadError')}
            </p>
          ) : services.data.length ? (
            <div className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {services.data.map((service) => (
                <PublicServiceCard key={service.id} service={service} />
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-lg bg-white px-4 py-5 text-sm text-slate-600 shadow-sm">
              {marketplaceT('noPublishedServices')}
            </p>
          )}
        </section>
        <div className="mt-8">
          <ReviewPanel targetType="BUSINESS" targetId={business.id} />
        </div>
      </Container>
    </main>
  );
}
