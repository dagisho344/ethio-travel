export const publicSearchParamKeys = [
  'q',
  'types',
  'regionSlug',
  'citySlug',
  'destinationSlug',
  'businessCategory',
  'serviceCategory',
  'pricingModel',
  'currency',
  'minPrice',
  'maxPrice',
  'sort',
  'page',
  'limit',
  'view',
] as const;

const mapParamKeys = [
  'q',
  'types',
  'regionSlug',
  'citySlug',
  'destinationSlug',
  'businessCategory',
  'serviceCategory',
  'pricingModel',
  'currency',
  'minPrice',
  'maxPrice',
] as const;

type CoordinateInput = {
  lat: number;
  lng: number;
  radiusKm: number;
};

export function allowedPublicSearchParams(
  source: URLSearchParams,
): URLSearchParams {
  const result = new URLSearchParams();
  for (const key of publicSearchParamKeys) {
    const value = source.get(key);
    if (value) result.set(key, value);
  }
  return result;
}

export function buildSearchRequestParams(
  source: URLSearchParams,
  nearby?: CoordinateInput | null,
): URLSearchParams {
  const result = allowedPublicSearchParams(source);
  result.delete('view');
  if (nearby) {
    result.set('lat', String(nearby.lat));
    result.set('lng', String(nearby.lng));
    result.set('radiusKm', String(nearby.radiusKm));
    if (!result.get('sort')) result.set('sort', 'distance');
  }
  return result;
}
export function buildMapPlacesParams(
  source: URLSearchParams,
  bounds: { north: number; south: number; east: number; west: number },
  nearby?: CoordinateInput | null,
): URLSearchParams {
  const result = new URLSearchParams();
  for (const key of mapParamKeys) {
    const value = source.get(key);
    if (value) result.set(key, value);
  }
  for (const [key, value] of Object.entries(bounds)) {
    result.set(key, String(value));
  }
  if (nearby) {
    result.set('lat', String(nearby.lat));
    result.set('lng', String(nearby.lng));
    result.set('radiusKm', String(nearby.radiusKm));
  }
  result.set('limit', '200');
  return result;
}

export function canonicalSearchHref(source: URLSearchParams): string {
  const query = allowedPublicSearchParams(source).toString();
  return query ? `/search?${query}` : '/search';
}
