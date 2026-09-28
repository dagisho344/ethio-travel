import type { Metadata } from 'next';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { FavoriteButton } from '../../../../../../../components/favorites/FavoriteButton';
import { AddToTripButton } from '../../../../../../../components/trips/AddToTripButton';
import { Container } from '../../../../../../../components/ui/Container';
import { getPublicDestination } from '../../../../../../../lib/public-destinations';
import type { Destination } from '../../../../../../../lib/types';
import { getRequestLocale } from '../../../../../../../i18n/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type PublicDestinationRouteParams = {
  regionSlug: string;
  citySlug: string;
  destinationSlug: string;
};

function publicDestinationApiPath({
  regionSlug,
  citySlug,
  destinationSlug,
}: PublicDestinationRouteParams): string {
  return `/regions/${encodeURIComponent(regionSlug)}/cities/${encodeURIComponent(citySlug)}/destinations/${encodeURIComponent(destinationSlug)}`;
}

async function publicDestination(
  route: PublicDestinationRouteParams,
): Promise<Destination> {
  return getPublicDestination(
    publicDestinationApiPath(route),
    await getRequestLocale(),
  );
}

export async function generateMetadata({
  params,
}: {
  params: Promise<PublicDestinationRouteParams>;
}): Promise<Metadata> {
  const [destinationsT, route] = await Promise.all([
    getTranslations('destinations'),
    params,
  ]);
  try {
    const destination = await publicDestination(route);
    return {
      title: `${destination.name} | EthioTravel`,
      description: destination.shortDescription,
    };
  } catch {
    return { title: `${destinationsT('title')} | EthioTravel` };
  }
}

export default async function PublicDestinationPage({
  params,
}: {
  params: Promise<PublicDestinationRouteParams>;
}) {
  const [destinationsT, marketplaceT] = await Promise.all([
    getTranslations('destinations'),
    getTranslations('marketplace'),
  ]);
  const route = await params;
  let destination: Destination;
  try {
    destination = await publicDestination(route);
  } catch {
    notFound();
  }

  return (
    <main className="bg-slate-50">
      <Container className="max-w-4xl py-10 sm:py-14">
        <Link
          href="/destinations"
          className="text-sm font-semibold text-highland hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-highland"
        >
          {destinationsT('back')}
        </Link>
        <article className="mt-5 rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <p className="text-sm font-semibold text-highland">
            {marketplaceT('destination')}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
            {destination.name}
          </h1>
          <p className="mt-5 text-lg leading-8 text-slate-700">
            {destination.shortDescription}
          </p>
          {destination.fullDescription ? (
            <p className="mt-5 whitespace-pre-line leading-7 text-slate-600">
              {destination.fullDescription}
            </p>
          ) : null}
          <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-5">
            <FavoriteButton
              targetType="DESTINATION"
              targetId={destination.id}
              targetName={destination.name}
              className="shrink-0"
            />
            <AddToTripButton
              targetType="DESTINATION"
              targetId={destination.id}
              targetName={destination.name}
            />
          </div>
        </article>
      </Container>
    </main>
  );
}
