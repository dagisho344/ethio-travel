import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ExternalLink, Mail, MapPin, Phone } from 'lucide-react';
import { FavoriteButton } from '../../../../../../../components/favorites/FavoriteButton';
import { StartConversationButton } from '../../../../../../../components/messaging/StartConversationButton';
import { PublicServiceCard } from '../../../../../../../components/public/PublicServiceCard';
import { ReviewPanel } from '../../../../../../../components/reviews/ReviewPanel';
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
  try {
    const business = await publicBusiness(await params);
    return {
      title: `${business.name} | EthioTravel`,
      description: business.description,
    };
  } catch {
    return { title: 'Business | EthioTravel' };
  }
}

export default async function PublicBusinessDetailPage({
  params,
}: {
  params: Promise<PublicBusinessRouteParams>;
}) {
  const route = await params;
  const business = await publicBusiness(route);
  const services = await safePage<Service>(
    `${publicBusinessApiPath(route)}/services`,
    { limit: 12 },
  );
  const location = [business.city?.name, business.region?.name]
    .filter(Boolean)
    .join(', ');
  const media = [business.media?.hero, business.media?.logo].filter(
    (item): item is NonNullable<typeof item> => Boolean(item),
  );
  const publicApiBase =
    process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api/v1';

  return (
    <main className="bg-slate-50">
      <Container className="py-8 sm:py-10">
        <Link
          href="/businesses"
          className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-highland hover:text-highland/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-offset-2"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Back to businesses
        </Link>
        <section className="mt-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">
              Verified business
            </span>
            {business.category?.name ? (
              <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                {business.category.name}
              </span>
            ) : null}
          </div>
          <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
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
          {media.length ? (
            <div
              className="mt-5 flex flex-wrap gap-3"
              aria-label="Public business media"
            >
              {media.map((item) => (
                <a
                  key={item.id}
                  href={`${publicApiBase}${item.accessPath}`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-highland hover:text-highland focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-offset-2"
                  target="_blank"
                  rel="noreferrer"
                >
                  {item.altText || item.caption || 'View public business image'}
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                </a>
              ))}
            </div>
          ) : null}
          <div className="mt-6 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <StartConversationButton
              businessId={business.id}
              label="Message business"
              className="inline-flex min-h-11 items-center justify-center rounded-md border border-highland px-3 font-semibold text-highland hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
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
                Website
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </a>
            ) : null}
          </div>
        </section>
        <section className="mt-8">
          <h2 className="text-2xl font-bold text-slate-950">
            Published services
          </h2>
          {!services ? (
            <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              We could not load this business&apos;s services right now.
            </p>
          ) : services.data.length ? (
            <div className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {services.data.map((service) => (
                <PublicServiceCard key={service.id} service={service} />
              ))}
            </div>
          ) : (
            <p className="mt-4 rounded-lg bg-white px-4 py-5 text-sm text-slate-600 shadow-sm">
              This verified business has no published services listed yet.
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
