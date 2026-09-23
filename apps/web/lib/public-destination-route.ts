import type { LocationSummary } from './types';

type PublicDestinationRouteSource = {
  slug: string;
  city?: Pick<LocationSummary, 'slug'>;
  region?: Pick<LocationSummary, 'slug'>;
};

export function publicDestinationPath(
  destination: PublicDestinationRouteSource,
): string | null {
  if (!destination.region?.slug || !destination.city?.slug || !destination.slug)
    return null;

  return `/regions/${encodeURIComponent(destination.region.slug)}/cities/${encodeURIComponent(destination.city.slug)}/destinations/${encodeURIComponent(destination.slug)}`;
}
