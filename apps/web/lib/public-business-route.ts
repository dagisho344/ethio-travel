import type { LocationSummary } from './types';

type PublicBusinessRouteSource = {
  slug: string;
  city?: Pick<LocationSummary, 'slug'>;
  region?: Pick<LocationSummary, 'slug'>;
};

export function publicBusinessPath(
  business: PublicBusinessRouteSource,
): string | null {
  if (!business.region?.slug || !business.city?.slug || !business.slug)
    return null;

  return `/regions/${encodeURIComponent(business.region.slug)}/cities/${encodeURIComponent(business.city.slug)}/businesses/${encodeURIComponent(business.slug)}`;
}
