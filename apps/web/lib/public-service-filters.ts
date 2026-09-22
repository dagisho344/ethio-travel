import type { PricingModel, ServiceCategoryFamily } from './types';

export type PublicServiceFilterValues = {
  category?: string;
  citySlug?: string;
  deliverySupported?: 'true' | 'false';
  destinationCitySlug?: string;
  destinationRegionSlug?: string;
  destinationSlug?: string;
  family?: ServiceCategoryFamily;
  maxDurationDays?: string;
  maxPrice?: string;
  minDurationDays?: string;
  minPrice?: string;
  minRoomCapacity?: string;
  originCitySlug?: string;
  originRegionSlug?: string;
  page?: string;
  pricingModel?: PricingModel;
  q?: string;
  regionSlug?: string;
  reservationSupported?: 'true' | 'false';
  starClass?: string;
};

type SearchParameterValue = string | string[] | undefined;

export const publicPricingModels: PricingModel[] = [
  'FREE',
  'CONTACT_FOR_PRICE',
  'FIXED',
  'PER_PERSON',
  'PER_NIGHT',
  'PER_HOUR',
  'PER_DAY',
  'STARTING_FROM',
];

const serviceFamilies: ServiceCategoryFamily[] = [
  'ACCOMMODATION',
  'RESTAURANT',
  'TOUR',
  'TRANSPORT',
  'OTHER',
];

function first(value: SearchParameterValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function text(
  value: SearchParameterValue,
  maximum: number,
): string | undefined {
  const candidate = first(value)?.trim();
  return candidate && candidate.length <= maximum ? candidate : undefined;
}

function nonnegativeDecimal(value: SearchParameterValue): string | undefined {
  const candidate = first(value)?.trim();
  return candidate && /^(?:0|[1-9]\d*)(?:\.\d+)?$/.test(candidate)
    ? candidate
    : undefined;
}

function positiveInteger(
  value: SearchParameterValue,
  maximum?: number,
): string | undefined {
  const candidate = first(value)?.trim();
  if (!candidate || !/^[1-9]\d*$/.test(candidate)) return undefined;
  const numeric = Number(candidate);
  return Number.isSafeInteger(numeric) && (!maximum || numeric <= maximum)
    ? candidate
    : undefined;
}

function strictBoolean(
  value: SearchParameterValue,
): 'true' | 'false' | undefined {
  const candidate = first(value);
  return candidate === 'true' || candidate === 'false' ? candidate : undefined;
}

function pricingModel(value: SearchParameterValue): PricingModel | undefined {
  const candidate = first(value) as PricingModel | undefined;
  return candidate && publicPricingModels.includes(candidate)
    ? candidate
    : undefined;
}

function family(
  value: SearchParameterValue,
): ServiceCategoryFamily | undefined {
  const candidate = first(value) as ServiceCategoryFamily | undefined;
  return candidate && serviceFamilies.includes(candidate)
    ? candidate
    : undefined;
}

export function parsePublicServiceFilters(
  searchParams: Record<string, SearchParameterValue>,
  fixedFamily?: ServiceCategoryFamily,
): PublicServiceFilterValues {
  const regionSlug = text(searchParams.regionSlug, 180);
  const citySlug = regionSlug ? text(searchParams.citySlug, 180) : undefined;
  const destinationSlug =
    regionSlug && citySlug
      ? text(searchParams.destinationSlug, 200)
      : undefined;
  const originRegionSlug = text(searchParams.originRegionSlug, 180);
  const destinationRegionSlug = text(searchParams.destinationRegionSlug, 180);

  return {
    q: text(searchParams.q, 120),
    family: fixedFamily ?? family(searchParams.family),
    regionSlug,
    citySlug,
    destinationSlug,
    category: text(searchParams.category, 80),
    pricingModel: pricingModel(searchParams.pricingModel),
    minPrice: nonnegativeDecimal(searchParams.minPrice),
    maxPrice: nonnegativeDecimal(searchParams.maxPrice),
    starClass: positiveInteger(searchParams.starClass, 5),
    minRoomCapacity: positiveInteger(searchParams.minRoomCapacity),
    reservationSupported: strictBoolean(searchParams.reservationSupported),
    deliverySupported: strictBoolean(searchParams.deliverySupported),
    minDurationDays: positiveInteger(searchParams.minDurationDays, 365),
    maxDurationDays: positiveInteger(searchParams.maxDurationDays, 365),
    originRegionSlug,
    originCitySlug: originRegionSlug
      ? text(searchParams.originCitySlug, 180)
      : undefined,
    destinationRegionSlug,
    destinationCitySlug: destinationRegionSlug
      ? text(searchParams.destinationCitySlug, 180)
      : undefined,
    page: positiveInteger(searchParams.page),
  };
}

const queryKeys: Array<keyof PublicServiceFilterValues> = [
  'q',
  'family',
  'regionSlug',
  'citySlug',
  'destinationSlug',
  'category',
  'pricingModel',
  'minPrice',
  'maxPrice',
  'starClass',
  'minRoomCapacity',
  'reservationSupported',
  'deliverySupported',
  'minDurationDays',
  'maxDurationDays',
  'originRegionSlug',
  'originCitySlug',
  'destinationRegionSlug',
  'destinationCitySlug',
];

export function publicServiceFilterQuery(
  filters: PublicServiceFilterValues,
  page?: number,
  omitFamily = false,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const key of queryKeys) {
    if (omitFamily && key === 'family') continue;
    const value = filters[key];
    if (value) params.set(key, value);
  }
  if (page && page > 1) params.set('page', String(page));
  return params;
}

export function publicServiceFilterHref(
  path: string,
  filters: PublicServiceFilterValues,
  page = 1,
  omitFamily = false,
): string {
  const query = publicServiceFilterQuery(filters, page, omitFamily).toString();
  return query ? `${path}?${query}` : path;
}

export function hasPublicServiceFilters(
  filters: PublicServiceFilterValues,
  fixedFamily = false,
): boolean {
  return queryKeys.some((key) => {
    if (fixedFamily && key === 'family') return false;
    return Boolean(filters[key]);
  });
}
