'use client';

import { Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import {
  hasPublicServiceFilters,
  publicPricingModels,
  publicServiceFilterHref,
  type PublicServiceFilterValues,
} from '../../lib/public-service-filters';
import type {
  Category,
  LocationSummary,
  PricingModel,
  ServiceCategoryFamily,
} from '../../lib/types';

type MarketplaceFamily = Exclude<ServiceCategoryFamily, 'OTHER'>;

type Props = {
  basePath: string;
  categories: Category[];
  cities: LocationSummary[];
  destinationCities: LocationSummary[];
  family: MarketplaceFamily;
  filters: PublicServiceFilterValues;
  originCities: LocationSummary[];
  regions: LocationSummary[];
};

const pricingLabelKeys: Record<
  PricingModel,
  | 'free'
  | 'contactForPrice'
  | 'fixedPrice'
  | 'perPerson'
  | 'perNight'
  | 'perHour'
  | 'perDay'
  | 'startingFrom'
> = {
  FREE: 'free',
  CONTACT_FOR_PRICE: 'contactForPrice',
  FIXED: 'fixedPrice',
  PER_PERSON: 'perPerson',
  PER_NIGHT: 'perNight',
  PER_HOUR: 'perHour',
  PER_DAY: 'perDay',
  STARTING_FROM: 'startingFrom',
};

function BooleanSelect({
  label,
  name,
  value,
  onChange,
  options,
}: {
  label: string;
  name: string;
  onChange: (value: 'true' | 'false' | '') => void;
  options: { any: string; no: string; yes: string };
  value: 'true' | 'false' | undefined;
}) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
      {label}
      <select
        name={name}
        value={value ?? ''}
        onChange={(event) =>
          onChange(event.target.value as 'true' | 'false' | '')
        }
        className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-highland focus:ring-2 focus:ring-highland/20"
      >
        <option value="">{options.any}</option>
        <option value="true">{options.yes}</option>
        <option value="false">{options.no}</option>
      </select>
    </label>
  );
}

export function CategoryServiceFilters({
  basePath,
  categories,
  cities,
  destinationCities,
  family,
  filters,
  originCities,
  regions,
}: Props) {
  const t = useTranslations('discovery');
  const router = useRouter();
  const [values, setValues] = useState<PublicServiceFilterValues>(filters);
  const genericCitiesLoaded = values.regionSlug === filters.regionSlug;
  const originCitiesLoaded =
    values.originRegionSlug === filters.originRegionSlug;
  const destinationCitiesLoaded =
    values.destinationRegionSlug === filters.destinationRegionSlug;

  function update(next: Partial<PublicServiceFilterValues>) {
    setValues((current) => ({ ...current, ...next, family }));
  }

  function href(next: Partial<PublicServiceFilterValues> = {}) {
    return publicServiceFilterHref(
      basePath,
      { ...values, ...next, family },
      1,
      true,
    );
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(href());
  }

  function input(
    label: string,
    name: keyof PublicServiceFilterValues,
    options: {
      inputMode?: 'decimal' | 'numeric';
      min?: number;
      type?: string;
    } = {},
  ) {
    return (
      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
        {label}
        <input
          name={name}
          type={options.type ?? 'text'}
          min={options.min}
          inputMode={options.inputMode}
          value={values[name] ?? ''}
          onChange={(event) => update({ [name]: event.target.value })}
          className="h-11 rounded-md border border-slate-300 px-3 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-highland focus:ring-2 focus:ring-highland/20"
        />
      </label>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mb-8 grid gap-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-4"
    >
      {input(t('search'), 'q')}
      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
        {t('region')}
        <select
          name="regionSlug"
          value={values.regionSlug ?? ''}
          onChange={(event) => {
            const regionSlug = event.target.value || undefined;
            update({
              regionSlug,
              citySlug: undefined,
              destinationSlug: undefined,
            });
            router.push(
              href({
                regionSlug,
                citySlug: undefined,
                destinationSlug: undefined,
              }),
            );
          }}
          className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-highland focus:ring-2 focus:ring-highland/20"
        >
          <option value="">{t('allRegions')}</option>
          {regions.map((region) => (
            <option key={region.slug} value={region.slug}>
              {region.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
        {t('city')}
        <select
          name="citySlug"
          value={genericCitiesLoaded ? (values.citySlug ?? '') : ''}
          onChange={(event) =>
            update({ citySlug: event.target.value || undefined })
          }
          disabled={!genericCitiesLoaded}
          className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 focus:border-highland focus:ring-2 focus:ring-highland/20"
        >
          <option value="">{t('allCities')}</option>
          {genericCitiesLoaded
            ? cities.map((city) => (
                <option key={city.slug} value={city.slug}>
                  {city.name}
                </option>
              ))
            : null}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
        {t('allCategories')}
        <select
          name="category"
          value={values.category ?? ''}
          onChange={(event) =>
            update({ category: event.target.value || undefined })
          }
          className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-highland focus:ring-2 focus:ring-highland/20"
        >
          <option value="">{t('allCategories')}</option>
          {categories.map((category) => (
            <option key={category.code} value={category.code}>
              {category.name}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
        {t('pricing')}
        <select
          name="pricingModel"
          value={values.pricingModel ?? ''}
          onChange={(event) =>
            update({
              pricingModel: (event.target.value || undefined) as
                PricingModel | undefined,
            })
          }
          className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-highland focus:ring-2 focus:ring-highland/20"
        >
          <option value="">{t('anyPricing')}</option>
          {publicPricingModels.map((model) => (
            <option key={model} value={model}>
              {t(pricingLabelKeys[model])}
            </option>
          ))}
        </select>
      </label>
      {input(t('minPrice'), 'minPrice', {
        type: 'number',
        min: 0,
        inputMode: 'decimal',
      })}
      {input(t('maxPrice'), 'maxPrice', {
        type: 'number',
        min: 0,
        inputMode: 'decimal',
      })}

      {family === 'ACCOMMODATION' ? (
        <>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            {t('starClass')}
            <select
              name="starClass"
              value={values.starClass ?? ''}
              onChange={(event) =>
                update({ starClass: event.target.value || undefined })
              }
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-highland focus:ring-2 focus:ring-highland/20"
            >
              <option value="">{t('anyStarClass')}</option>
              {[1, 2, 3, 4, 5].map((starClass) => (
                <option key={starClass} value={starClass}>
                  {t('star', { count: starClass })}
                </option>
              ))}
            </select>
          </label>
          {input(t('minRoomCapacity'), 'minRoomCapacity', {
            type: 'number',
            min: 1,
            inputMode: 'numeric',
          })}
        </>
      ) : null}

      {family === 'RESTAURANT' ? (
        <>
          <BooleanSelect
            label={t('reservationSupported')}
            name="reservationSupported"
            value={values.reservationSupported}
            onChange={(reservationSupported) =>
              update({
                reservationSupported: reservationSupported || undefined,
              })
            }
            options={{ any: t('any'), no: t('no'), yes: t('yes') }}
          />
          <BooleanSelect
            label={t('deliverySupported')}
            name="deliverySupported"
            value={values.deliverySupported}
            onChange={(deliverySupported) =>
              update({ deliverySupported: deliverySupported || undefined })
            }
            options={{ any: t('any'), no: t('no'), yes: t('yes') }}
          />
        </>
      ) : null}

      {family === 'TOUR' ? (
        <>
          {input(t('minDuration'), 'minDurationDays', {
            type: 'number',
            min: 1,
            inputMode: 'numeric',
          })}
          {input(t('maxDuration'), 'maxDurationDays', {
            type: 'number',
            min: 1,
            inputMode: 'numeric',
          })}
        </>
      ) : null}

      {family === 'TRANSPORT' ? (
        <>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            {t('originRegion')}
            <select
              name="originRegionSlug"
              value={values.originRegionSlug ?? ''}
              onChange={(event) => {
                const originRegionSlug = event.target.value || undefined;
                update({ originRegionSlug, originCitySlug: undefined });
                router.push(
                  href({ originRegionSlug, originCitySlug: undefined }),
                );
              }}
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-highland focus:ring-2 focus:ring-highland/20"
            >
              <option value="">{t('anyOriginRegion')}</option>
              {regions.map((region) => (
                <option key={region.slug} value={region.slug}>
                  {region.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            {t('originCity')}
            <select
              name="originCitySlug"
              value={originCitiesLoaded ? (values.originCitySlug ?? '') : ''}
              onChange={(event) =>
                update({ originCitySlug: event.target.value || undefined })
              }
              disabled={!originCitiesLoaded}
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 focus:border-highland focus:ring-2 focus:ring-highland/20"
            >
              <option value="">{t('anyOriginCity')}</option>
              {originCitiesLoaded
                ? originCities.map((city) => (
                    <option key={city.slug} value={city.slug}>
                      {city.name}
                    </option>
                  ))
                : null}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            {t('destinationRegion')}
            <select
              name="destinationRegionSlug"
              value={values.destinationRegionSlug ?? ''}
              onChange={(event) => {
                const destinationRegionSlug = event.target.value || undefined;
                update({
                  destinationRegionSlug,
                  destinationCitySlug: undefined,
                });
                router.push(
                  href({
                    destinationRegionSlug,
                    destinationCitySlug: undefined,
                  }),
                );
              }}
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-highland focus:ring-2 focus:ring-highland/20"
            >
              <option value="">{t('anyDestinationRegion')}</option>
              {regions.map((region) => (
                <option key={region.slug} value={region.slug}>
                  {region.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            {t('destinationCity')}
            <select
              name="destinationCitySlug"
              value={
                destinationCitiesLoaded
                  ? (values.destinationCitySlug ?? '')
                  : ''
              }
              onChange={(event) =>
                update({ destinationCitySlug: event.target.value || undefined })
              }
              disabled={!destinationCitiesLoaded}
              className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 focus:border-highland focus:ring-2 focus:ring-highland/20"
            >
              <option value="">{t('anyDestinationCity')}</option>
              {destinationCitiesLoaded
                ? destinationCities.map((city) => (
                    <option key={city.slug} value={city.slug}>
                      {city.name}
                    </option>
                  ))
                : null}
            </select>
          </label>
        </>
      ) : null}

      <div className="flex items-end gap-2 md:col-span-2 xl:col-span-4">
        <button className="inline-flex h-11 items-center gap-2 rounded-md bg-highland px-5 text-sm font-semibold text-white transition hover:bg-highland/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-offset-2">
          <Search className="h-4 w-4" aria-hidden="true" />
          {t('applyFilters')}
        </button>
        {hasPublicServiceFilters(values, true) ? (
          <button
            type="button"
            onClick={() => router.push(basePath)}
            className="inline-flex h-11 items-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-highland hover:text-highland focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-offset-2"
          >
            {t('clearFilters')}
          </button>
        ) : null}
      </div>
    </form>
  );
}
