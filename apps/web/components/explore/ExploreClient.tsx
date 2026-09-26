'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Filter, List, LocateFixed, Map, Search, X } from 'lucide-react';
import { getJson } from '../../lib/api';
import {
  allowedPublicSearchParams,
  buildMapPlacesParams,
  buildSearchRequestParams,
} from '../../lib/public-discovery-query';
import {
  buildFavoriteLookup,
  type FavoriteLookup,
} from '../../lib/favorite-utils';
import { buildReviewLookup, type ReviewLookup } from '../../lib/review-utils';
import type {
  Category,
  Favorite,
  MyReview,
  LocationSummary,
  MapPlace,
  PaginatedResponse,
  SearchResult,
} from '../../lib/types';
import { SearchResultCard } from '../cards/TravelCards';
import { DynamicMap } from '../map/DynamicMap';
import { ErrorState } from '../ui/States';

type ViewMode = 'list' | 'map';

const typeOptions = [
  ['destination', 'destinations'],
  ['attraction', 'attractions'],
  ['business', 'businesses'],
  ['service', 'services'],
] as const;

const sortOptions = [
  ['relevance', 'relevance'],
  ['name_asc', 'nameAsc'],
  ['name_desc', 'nameDesc'],
  ['newest', 'newest'],
] as const;

const pricingModelOptions = [
  ['FIXED', 'fixedPrice'],
  ['PER_PERSON', 'perPerson'],
  ['PER_NIGHT', 'perNight'],
  ['PER_HOUR', 'perHour'],
  ['PER_DAY', 'perDay'],
  ['STARTING_FROM', 'startingFrom'],
  ['FREE', 'free'],
  ['CONTACT_FOR_PRICE', 'contactForPrice'],
] as const;

const filterKeys = [
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
] as const;

function textValue(form: FormData, key: string): string {
  const value = form.get(key);
  return typeof value === 'string' ? value.trim() : '';
}

function paramsWithUpdates(
  params: URLSearchParams,
  updates: Record<string, string | null>,
) {
  const next = new URLSearchParams(params);
  Object.entries(updates).forEach(([key, value]) => {
    if (!value) next.delete(key);
    else next.set(key, value);
  });
  return next;
}

function categoryLabel(categories: Category[], code: string) {
  return categories.find((category) => category.code === code)?.name ?? code;
}

function locationLabel(options: LocationSummary[], slug: string) {
  return options.find((option) => option.slug === slug)?.name ?? slug;
}

function hasActiveFilters(params: URLSearchParams) {
  return filterKeys.some((key) => {
    const value = params.get(key);
    return Boolean(value && !(key === 'sort' && value === 'relevance'));
  });
}

function controlClassName() {
  return 'mt-1.5 w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none focus:border-highland focus:ring-2 focus:ring-highland/20';
}

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-slate-100 pt-4 first:border-t-0 first:pt-0">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <div className="mt-3 space-y-3">{children}</div>
    </section>
  );
}

function ResultsEmptyState({
  hasFilters,
  onClear,
}: {
  hasFilters: boolean;
  onClear: () => void;
}) {
  const t = useTranslations('discovery');
  return (
    <div className="flex min-h-[360px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-sm">
      <div className="flex h-12 w-12 items-center justify-center rounded-md bg-slate-100 text-highland">
        <Search className="h-5 w-5" aria-hidden="true" />
      </div>
      <h3 className="mt-4 text-lg font-bold text-slate-950">
        {t('noResultsTitle')}
      </h3>
      <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">
        {t('noResultsMessage')}
      </p>
      {hasFilters ? (
        <button
          type="button"
          onClick={onClear}
          className="mt-5 rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:border-highland hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
        >
          {t('clearFilters')}
        </button>
      ) : null}
    </div>
  );
}

export function ExploreClient({
  businessCategories,
  serviceCategories,
  regions,
  cities,
  destinations,
  normalizedRegionSlug,
  normalizedCitySlug,
  normalizedDestinationSlug,
}: {
  businessCategories: Category[];
  serviceCategories: Category[];
  regions: LocationSummary[];
  cities: LocationSummary[];
  destinations: LocationSummary[];
  normalizedRegionSlug: string;
  normalizedCitySlug: string;
  normalizedDestinationSlug: string;
}) {
  const t = useTranslations('discovery');
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [results, setResults] =
    useState<PaginatedResponse<SearchResult> | null>(null);
  const [places, setPlaces] = useState<MapPlace[]>([]);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapLoading, setMapLoading] = useState(false);
  const searchRequestId = useRef(0);
  const mapRequestId = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [favoriteLookup, setFavoriteLookup] = useState<FavoriteLookup>({});
  const [reviewLookup, setReviewLookup] = useState<ReviewLookup>({});
  const [view, setView] = useState<ViewMode>(
    (searchParams.get('view') as ViewMode) === 'map' ? 'map' : 'list',
  );
  const [nearby, setNearby] = useState<{
    lat: number;
    lng: number;
    radiusKm: number;
  } | null>(null);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [selectedPlaceKey, setSelectedPlaceKey] = useState<string | null>(null);

  const selectedTypes = (searchParams.get('types') ?? '')
    .split(',')
    .filter(Boolean);
  const selectedRegionSlug = normalizedRegionSlug;
  const selectedCitySlug = normalizedCitySlug;
  const selectedDestinationSlug = normalizedDestinationSlug;

  const normalizedParams = useMemo(() => {
    const next = allowedPublicSearchParams(searchParams);
    next.delete('view');
    if (selectedRegionSlug) next.set('regionSlug', selectedRegionSlug);
    else next.delete('regionSlug');
    if (selectedCitySlug) next.set('citySlug', selectedCitySlug);
    else next.delete('citySlug');
    if (selectedDestinationSlug)
      next.set('destinationSlug', selectedDestinationSlug);
    else next.delete('destinationSlug');
    return next;
  }, [
    searchParams,
    selectedCitySlug,
    selectedDestinationSlug,
    selectedRegionSlug,
  ]);

  const query = useMemo(
    () => buildSearchRequestParams(normalizedParams, nearby).toString(),
    [nearby, normalizedParams],
  );
  const activeFilters = hasActiveFilters(normalizedParams) || nearby !== null;
  const hasPriceContext = Boolean(
    normalizedParams.get('pricingModel') && normalizedParams.get('currency'),
  );

  useEffect(() => {
    const rawRegionSlug = searchParams.get('regionSlug') ?? '';
    const rawCitySlug = searchParams.get('citySlug') ?? '';
    const rawDestinationSlug = searchParams.get('destinationSlug') ?? '';
    if (
      rawRegionSlug !== selectedRegionSlug ||
      rawCitySlug !== selectedCitySlug ||
      rawDestinationSlug !== selectedDestinationSlug
    ) {
      const next = allowedPublicSearchParams(searchParams);
      if (selectedRegionSlug) next.set('regionSlug', selectedRegionSlug);
      else next.delete('regionSlug');
      if (selectedCitySlug) next.set('citySlug', selectedCitySlug);
      else next.delete('citySlug');
      if (selectedDestinationSlug)
        next.set('destinationSlug', selectedDestinationSlug);
      else next.delete('destinationSlug');
      const url = next.toString() ? `${pathname}?${next.toString()}` : pathname;
      router.replace(url, { scroll: false });
    }
  }, [
    pathname,
    router,
    searchParams,
    selectedCitySlug,
    selectedDestinationSlug,
    selectedRegionSlug,
  ]);

  useEffect(() => {
    const run = async () => {
      try {
        const [favorites, reviews] = await Promise.all([
          fetch('/api/favorites?limit=100', { cache: 'no-store' }),
          fetch('/api/reviews?mine=true&limit=100', { cache: 'no-store' }),
        ]);
        if (favorites.ok) {
          const data = (await favorites.json()) as { data?: Favorite[] };
          setFavoriteLookup(buildFavoriteLookup(data.data ?? []));
        }
        if (reviews.ok) {
          const data = (await reviews.json()) as { data?: MyReview[] };
          setReviewLookup(buildReviewLookup(data.data ?? []));
        }
      } catch {
        setFavoriteLookup({});
        setReviewLookup({});
      }
    };
    void run();
  }, []);

  useEffect(() => {
    const requestId = searchRequestId.current + 1;
    searchRequestId.current = requestId;
    const run = async () => {
      if (requestId === searchRequestId.current) setError(null);
      try {
        const data = await getJson<PaginatedResponse<SearchResult>>(
          `/search?${query}`,
        );
        if (requestId === searchRequestId.current) setResults(data);
      } catch (err) {
        if (requestId === searchRequestId.current) {
          setResults(null);
          setError(err instanceof Error ? err.message : t('searchFailed'));
        }
      }
    };
    void run();
  }, [query]);

  const update = (updates: Record<string, string | null>) =>
    startTransition(() => {
      const normalizedUpdates = { ...updates };
      if (Object.prototype.hasOwnProperty.call(updates, 'regionSlug')) {
        normalizedUpdates.citySlug = null;
        normalizedUpdates.destinationSlug = null;
      }
      if (Object.prototype.hasOwnProperty.call(updates, 'citySlug')) {
        normalizedUpdates.destinationSlug = null;
      }
      if (
        Object.prototype.hasOwnProperty.call(updates, 'destinationSlug') &&
        (!selectedRegionSlug || !selectedCitySlug)
      ) {
        normalizedUpdates.destinationSlug = null;
      }
      const next = paramsWithUpdates(allowedPublicSearchParams(searchParams), {
        ...normalizedUpdates,
        page: normalizedUpdates.page ?? '1',
      });
      if (!next.get('regionSlug')) {
        next.delete('citySlug');
        next.delete('destinationSlug');
      }
      if (!next.get('citySlug')) next.delete('destinationSlug');
      const url = next.toString() ? `${pathname}?${next.toString()}` : pathname;
      router.push(url);
    });

  const clearFilters = () => {
    startTransition(() => {
      const next = allowedPublicSearchParams(searchParams);
      filterKeys.forEach((key) => next.delete(key));
      setNearby(null);
      setNearbyError(null);
      const viewParam = searchParams.get('view');
      if (viewParam) next.set('view', viewParam);
      const url = next.toString() ? `${pathname}?${next.toString()}` : pathname;
      router.push(url);
    });
  };

  const removeFilter = (key: string) => {
    if (key === 'nearby') {
      setNearby(null);
      setNearbyError(null);
      if (normalizedParams.get('sort') === 'distance') update({ sort: null });
      return;
    }
    if (key === 'regionSlug') {
      update({ regionSlug: null, citySlug: null, destinationSlug: null });
      return;
    }
    if (key === 'citySlug') {
      update({ citySlug: null, destinationSlug: null });
      return;
    }
    if (key === 'pricingModel' || key === 'currency') {
      update({ [key]: null, minPrice: null, maxPrice: null });
      return;
    }
    update({ [key]: null });
  };

  const activeChips = [
    normalizedParams.get('q')
      ? {
          key: 'q',
          label: t('searchPrefix', {
            query: normalizedParams.get('q') ?? '',
          }),
        }
      : null,
    selectedTypes.length
      ? {
          key: 'types',
          label: selectedTypes
            .map((type) => {
              const option = typeOptions.find(([value]) => value === type);
              return option ? t(option[1]) : type;
            })
            .join(', '),
        }
      : null,
    selectedRegionSlug
      ? {
          key: 'regionSlug',
          label: locationLabel(regions, selectedRegionSlug),
        }
      : null,
    selectedCitySlug
      ? {
          key: 'citySlug',
          label: locationLabel(cities, selectedCitySlug),
        }
      : null,
    selectedDestinationSlug
      ? {
          key: 'destinationSlug',
          label: locationLabel(destinations, selectedDestinationSlug),
        }
      : null,
    normalizedParams.get('businessCategory')
      ? {
          key: 'businessCategory',
          label: categoryLabel(
            businessCategories,
            normalizedParams.get('businessCategory') ?? '',
          ),
        }
      : null,
    normalizedParams.get('serviceCategory')
      ? {
          key: 'serviceCategory',
          label: categoryLabel(
            serviceCategories,
            normalizedParams.get('serviceCategory') ?? '',
          ),
        }
      : null,
    normalizedParams.get('pricingModel')
      ? {
          key: 'pricingModel',
          label: t('pricingPrefix', {
            value: (() => {
              const option = pricingModelOptions.find(
                ([value]) => value === normalizedParams.get('pricingModel'),
              );
              return option
                ? t(option[1])
                : (normalizedParams.get('pricingModel') ?? '');
            })(),
          }),
        }
      : null,
    normalizedParams.get('currency')
      ? {
          key: 'currency',
          label: t('currencyPrefix', {
            currency: normalizedParams.get('currency') ?? '',
          }),
        }
      : null,
    normalizedParams.get('minPrice') || normalizedParams.get('maxPrice')
      ? {
          key: 'price',
          label: t('priceRange', {
            min: normalizedParams.get('minPrice') || '0',
            max: normalizedParams.get('maxPrice') || t('any'),
          }),
        }
      : null,
    normalizedParams.get('sort') && normalizedParams.get('sort') !== 'relevance'
      ? {
          key: 'sort',
          label: (() => {
            const option = sortOptions.find(
              ([value]) => value === normalizedParams.get('sort'),
            );
            return option
              ? t(option[1])
              : normalizedParams.get('sort') === 'distance'
                ? t('distance')
                : t('sort');
          })(),
        }
      : null,
    nearby
      ? {
          key: 'nearby',
          label: t('nearMeWithin', { radius: nearby.radiusKm }),
        }
      : null,
  ].filter((chip): chip is { key: string; label: string } => Boolean(chip));

  const loadMap = async (bounds: {
    north: number;
    south: number;
    east: number;
    west: number;
  }) => {
    const requestId = mapRequestId.current + 1;
    mapRequestId.current = requestId;
    setMapLoading(true);
    setMapError(null);
    try {
      const params = buildMapPlacesParams(normalizedParams, bounds, nearby);
      const data = await getJson<{ data: MapPlace[] }>(
        `/map/places?${params.toString()}`,
      );
      if (requestId === mapRequestId.current) setPlaces(data.data);
    } catch (mapRequestError) {
      if (requestId === mapRequestId.current) {
        setMapError(
          mapRequestError instanceof Error
            ? mapRequestError.message
            : t('mapFailed'),
        );
      }
    } finally {
      if (requestId === mapRequestId.current) setMapLoading(false);
    }
  };
  const requestNearby = () => {
    if (!navigator.geolocation) {
      setNearbyError(t('locationUnavailable'));
      return;
    }
    setNearbyError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setNearby({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          radiusKm: 25,
        });
        setSelectedPlaceKey(null);
      },
      () => {
        setNearbyError(t('locationDenied'));
      },
      { enableHighAccuracy: false, maximumAge: 0, timeout: 10_000 },
    );
  };

  const renderFilterPanel = (idPrefix: string) => (
    <div className="space-y-5">
      <FilterSection title={t('search')}>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            update({ q: textValue(form, 'q') || null });
          }}
        >
          <label className="sr-only" htmlFor={`${idPrefix}-explore-q`}>
            {t('searchPlaceholder')}
          </label>
          <input
            id={`${idPrefix}-explore-q`}
            name="q"
            defaultValue={normalizedParams.get('q') ?? ''}
            className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none focus:border-highland focus:ring-2 focus:ring-highland/20"
            placeholder={t('searchPlaceholder')}
          />
          <button className="inline-flex items-center justify-center rounded-md bg-highland px-3 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2">
            <Search className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">{t('search')}</span>
          </button>
        </form>
      </FilterSection>

      <FilterSection title={t('nearMe')}>
        <button
          type="button"
          onClick={requestNearby}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-highland bg-white px-3 py-2.5 text-sm font-semibold text-highland hover:bg-highland hover:text-white focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
        >
          <LocateFixed className="h-4 w-4" aria-hidden="true" />
          {nearby ? t('refreshLocation') : t('useLocation')}
        </button>
        {nearby ? (
          <label
            className="block text-xs font-semibold text-slate-600"
            htmlFor={`${idPrefix}-nearby-radius`}
          >
            {t('distance')}
            <select
              id={`${idPrefix}-nearby-radius`}
              className={controlClassName()}
              value={nearby.radiusKm}
              onChange={(event) =>
                setNearby((current) =>
                  current
                    ? { ...current, radiusKm: Number(event.target.value) }
                    : current,
                )
              }
            >
              {[5, 10, 25, 50, 100].map((radiusKm) => (
                <option key={radiusKm} value={radiusKm}>
                  {radiusKm} km
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {nearbyError ? (
          <p className="text-xs leading-5 text-amber-800" role="status">
            {nearbyError}
          </p>
        ) : null}
      </FilterSection>

      <FilterSection title={t('allTypes')}>
        <div className="grid gap-2">
          {typeOptions.map(([type, labelKey]) => {
            const active = selectedTypes.includes(type);
            return (
              <button
                key={type}
                type="button"
                onClick={() => {
                  const next = active
                    ? selectedTypes.filter((item) => item !== type)
                    : [...selectedTypes, type];
                  update({ types: next.join(',') || null });
                }}
                className={`flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm font-medium focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 ${active ? 'border-highland bg-highland text-white' : 'border-slate-200 bg-white text-slate-700 hover:border-highland hover:text-highland'}`}
              >
                {t(labelKey)}
                {active ? (
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                ) : null}
              </button>
            );
          })}
        </div>
      </FilterSection>

      <FilterSection title={t('region')}>
        <label
          className="block text-xs font-semibold text-slate-600"
          htmlFor={`${idPrefix}-regionSlug`}
        >
          {t('region')}
        </label>
        <select
          id={`${idPrefix}-regionSlug`}
          value={selectedRegionSlug}
          onChange={(e) => update({ regionSlug: e.target.value || null })}
          className={controlClassName()}
        >
          <option value="">{t('allRegions')}</option>
          {regions.map((region) => (
            <option key={region.slug} value={region.slug}>
              {region.name}
            </option>
          ))}
        </select>

        <label
          className="block text-xs font-semibold text-slate-600"
          htmlFor={`${idPrefix}-citySlug`}
        >
          {t('city')}
        </label>
        <select
          id={`${idPrefix}-citySlug`}
          value={selectedCitySlug}
          disabled={!selectedRegionSlug}
          onChange={(e) => update({ citySlug: e.target.value || null })}
          className={`${controlClassName()} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500`}
        >
          <option value="">{t('allCities')}</option>
          {cities.map((city) => (
            <option key={city.slug} value={city.slug}>
              {city.name}
            </option>
          ))}
        </select>

        <label
          className="block text-xs font-semibold text-slate-600"
          htmlFor={`${idPrefix}-destinationSlug`}
        >
          {t('destination')}
        </label>
        <select
          id={`${idPrefix}-destinationSlug`}
          value={selectedDestinationSlug}
          disabled={!selectedRegionSlug || !selectedCitySlug}
          onChange={(e) => update({ destinationSlug: e.target.value || null })}
          className={`${controlClassName()} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500`}
        >
          <option value="">{t('allDestinations')}</option>
          {destinations.map((destination) => (
            <option key={destination.slug} value={destination.slug}>
              {destination.name}
            </option>
          ))}
        </select>
      </FilterSection>

      <FilterSection title={t('allCategories')}>
        <label
          className="block text-xs font-semibold text-slate-600"
          htmlFor={`${idPrefix}-businessCategory`}
        >
          {t('businessCategory')}
        </label>
        <select
          id={`${idPrefix}-businessCategory`}
          className={controlClassName()}
          value={normalizedParams.get('businessCategory') ?? ''}
          onChange={(e) => update({ businessCategory: e.target.value || null })}
        >
          <option value="">{t('allCategories')}</option>
          {businessCategories.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
        <label
          className="block text-xs font-semibold text-slate-600"
          htmlFor={`${idPrefix}-serviceCategory`}
        >
          {t('serviceCategory')}
        </label>
        <select
          id={`${idPrefix}-serviceCategory`}
          className={controlClassName()}
          value={normalizedParams.get('serviceCategory') ?? ''}
          onChange={(e) => update({ serviceCategory: e.target.value || null })}
        >
          <option value="">{t('allCategories')}</option>
          {serviceCategories.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
        </select>
      </FilterSection>

      <FilterSection title={t('pricing')}>
        <p className="text-xs leading-5 text-slate-500">
          {t('priceRangeNotice')}
        </p>
        <div className="grid grid-cols-2 gap-2">
          <label
            className="block text-xs font-semibold text-slate-600"
            htmlFor={`${idPrefix}-pricingModel`}
          >
            {t('pricing')}
            <select
              id={`${idPrefix}-pricingModel`}
              value={normalizedParams.get('pricingModel') ?? ''}
              onChange={(event) => {
                const pricingModel = event.target.value || null;
                update({
                  pricingModel,
                  minPrice: null,
                  maxPrice: null,
                });
              }}
              className={controlClassName()}
            >
              <option value="">{t('anyPricing')}</option>
              {pricingModelOptions.map(([value, labelKey]) => (
                <option key={value} value={value}>
                  {t(labelKey)}
                </option>
              ))}
            </select>
          </label>
          <label
            className="block text-xs font-semibold text-slate-600"
            htmlFor={`${idPrefix}-currency`}
          >
            {t('currency')}
            <input
              key={`${idPrefix}-currency-${normalizedParams.get('currency') ?? ''}`}
              id={`${idPrefix}-currency`}
              type="text"
              maxLength={3}
              defaultValue={normalizedParams.get('currency') ?? ''}
              onBlur={(event) => {
                const currency = event.target.value.trim().toUpperCase();
                if (!currency || /^[A-Z]{3}$/.test(currency)) {
                  update({
                    currency: currency || null,
                    minPrice: null,
                    maxPrice: null,
                  });
                }
              }}
              className={controlClassName()}
              placeholder="ETB"
              pattern="[A-Za-z]{3}"
              title={t('currencyCodeHint')}
            />
          </label>
          <label
            className="block text-xs font-semibold text-slate-600"
            htmlFor={`${idPrefix}-minPrice`}
          >
            {t('minPrice')}
            <input
              id={`${idPrefix}-minPrice`}
              type="number"
              min="0"
              disabled={!hasPriceContext}
              value={normalizedParams.get('minPrice') ?? ''}
              onChange={(e) => update({ minPrice: e.target.value || null })}
              className={`${controlClassName()} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500`}
            />
          </label>
          <label
            className="block text-xs font-semibold text-slate-600"
            htmlFor={`${idPrefix}-maxPrice`}
          >
            {t('maxPrice')}
            <input
              id={`${idPrefix}-maxPrice`}
              type="number"
              min="0"
              disabled={!hasPriceContext}
              value={normalizedParams.get('maxPrice') ?? ''}
              onChange={(e) => update({ maxPrice: e.target.value || null })}
              className={`${controlClassName()} disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500`}
            />
          </label>
        </div>
      </FilterSection>

      <FilterSection title={t('sort')}>
        <label className="sr-only" htmlFor={`${idPrefix}-sort`}>
          {t('sort')}
        </label>
        <select
          id={`${idPrefix}-sort`}
          className={controlClassName()}
          value={
            normalizedParams.get('sort') ?? (nearby ? 'distance' : 'relevance')
          }
          onChange={(e) => update({ sort: e.target.value })}
        >
          {sortOptions.map(([value, labelKey]) => (
            <option key={value} value={value}>
              {t(labelKey)}
            </option>
          ))}
          {nearby ? <option value="distance">{t('distance')}</option> : null}
        </select>
      </FilterSection>
    </div>
  );

  return (
    <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)] lg:items-start">
      <aside className="hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:block lg:sticky lg:top-24">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-slate-950">{t('filters')}</h2>
          {activeFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="text-sm font-semibold text-highland hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-highland"
            >
              {t('clearAll')}
            </button>
          ) : null}
        </div>
        {renderFilterPanel('desktop')}
      </aside>

      <details className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm lg:hidden">
        <summary className="flex cursor-pointer list-none items-center justify-between rounded-md px-1 py-1 text-sm font-bold text-slate-950 focus:outline-none focus:ring-2 focus:ring-highland [&::-webkit-details-marker]:hidden">
          <span className="inline-flex items-center gap-2">
            <Filter className="h-4 w-4 text-highland" aria-hidden="true" />
            {t('filters')}
          </span>
          {activeFilters ? (
            <span className="rounded-full bg-highland px-2 py-0.5 text-xs font-semibold text-white">
              {activeChips.length}
            </span>
          ) : null}
        </summary>
        <div className="mt-4">{renderFilterPanel('mobile')}</div>
      </details>

      <section className="min-w-0">
        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-950">
                {results
                  ? t('results', { count: results.meta.total })
                  : t('searching')}
              </p>
              <p className="mt-1 text-xs text-slate-500">{t('resultScope')}</p>
            </div>
            <div className="inline-flex w-full rounded-md border border-slate-200 bg-slate-50 p-1 sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  setView('list');
                  update({ view: 'list' });
                }}
                className={`inline-flex flex-1 items-center justify-center gap-2 rounded px-3 py-1.5 text-sm font-semibold sm:flex-none ${view === 'list' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:text-highland'}`}
              >
                <List className="h-4 w-4" aria-hidden="true" /> {t('list')}
              </button>
              <button
                type="button"
                onClick={() => {
                  setView('map');
                  update({ view: 'map' });
                }}
                className={`inline-flex flex-1 items-center justify-center gap-2 rounded px-3 py-1.5 text-sm font-semibold sm:flex-none ${view === 'map' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:text-highland'}`}
              >
                <Map className="h-4 w-4" aria-hidden="true" /> {t('map')}
              </button>
            </div>
          </div>

          {activeChips.length ? (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
              {activeChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => {
                    if (chip.key === 'price')
                      update({ minPrice: null, maxPrice: null });
                    else removeFilter(chip.key);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-700 hover:border-highland hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland"
                >
                  {chip.label}
                  <X className="h-3 w-3" aria-hidden="true" />
                </button>
              ))}
              <button
                type="button"
                onClick={clearFilters}
                className="text-xs font-semibold text-highland hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-highland"
              >
                {t('clearAll')}
              </button>
            </div>
          ) : null}
        </div>

        <div className="mt-5">
          {error ? <ErrorState message={error} /> : null}
          {view === 'map' ? (
            <div className="overflow-hidden rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
              {mapError ? <ErrorState message={mapError} /> : null}
              {mapLoading ? (
                <p className="px-3 py-2 text-sm text-slate-500" role="status">
                  {t('updatingMap')}
                </p>
              ) : null}
              <DynamicMap
                places={places}
                selectedPlaceKey={selectedPlaceKey}
                nearbyPosition={nearby}
                onSelectPlace={(place) =>
                  setSelectedPlaceKey(`${place.type}:${place.id}`)
                }
                onBoundsChange={(bounds) => {
                  void loadMap(bounds);
                }}
              />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {results?.data.map((result) => (
                <SearchResultCard
                  key={`${result.type}-${result.id}`}
                  result={result}
                  favoriteLookup={favoriteLookup}
                  reviewLookup={reviewLookup}
                  onShowOnMap={() => {
                    setSelectedPlaceKey(`${result.type}:${result.id}`);
                    setView('map');
                    update({ view: 'map' });
                  }}
                />
              ))}
              {isPending || !results ? (
                <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
                  {t('loadingResults')}
                </div>
              ) : null}
              {results && results.data.length === 0 ? (
                <div className="md:col-span-2 xl:col-span-3">
                  <ResultsEmptyState
                    hasFilters={activeFilters}
                    onClear={clearFilters}
                  />
                </div>
              ) : null}
            </div>
          )}
        </div>

        {results && results.meta.totalPages > 1 ? (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            <button
              disabled={results.meta.page <= 1}
              onClick={() => update({ page: String(results.meta.page - 1) })}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
            >
              {t('previous')}
            </button>
            <span className="px-3 py-2 text-sm text-slate-600">
              {t('pageOf', {
                page: results.meta.page,
                total: results.meta.totalPages,
              })}
            </span>
            <button
              disabled={results.meta.page >= results.meta.totalPages}
              onClick={() => update({ page: String(results.meta.page + 1) })}
              className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40"
            >
              {t('next')}
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
