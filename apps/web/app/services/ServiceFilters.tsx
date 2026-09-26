'use client';

import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import type { FormEvent } from 'react';
import { useState } from 'react';
import {
  hasPublicServiceFilters,
  publicPricingModels,
  publicServiceFilterHref,
  type PublicServiceFilterValues,
} from '../../lib/public-service-filters';
import type { Category, LocationSummary, PricingModel } from '../../lib/types';

interface ServiceFiltersProps {
  q: string;
  regionSlug: string;
  citySlug: string;
  category: string;
  pricingModel: string;
  minPrice: string;
  maxPrice: string;
  regions: LocationSummary[];
  cities: LocationSummary[];
  categories: Category[];
}

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

export function ServiceFilters({
  q,
  regionSlug,
  citySlug,
  category,
  pricingModel,
  minPrice,
  maxPrice,
  regions,
  cities,
  categories,
}: ServiceFiltersProps) {
  const t = useTranslations('discovery');
  const pricingOptions = publicPricingModels.map((value) => ({
    value,
    label: t(pricingLabelKeys[value]),
  }));
  const router = useRouter();
  const [search, setSearch] = useState(q);
  const [selectedRegion, setSelectedRegion] = useState(regionSlug);
  const [selectedCity, setSelectedCity] = useState(citySlug);
  const [selectedCategory, setSelectedCategory] = useState(category);
  const [selectedPricingModel, setSelectedPricingModel] = useState<
    PricingModel | ''
  >(pricingModel as PricingModel | '');
  const [selectedMinPrice, setSelectedMinPrice] = useState(minPrice);
  const [selectedMaxPrice, setSelectedMaxPrice] = useState(maxPrice);
  const cityOptionsLoaded =
    Boolean(selectedRegion) && selectedRegion === regionSlug;
  const hasFilters = hasPublicServiceFilters({
    q,
    regionSlug,
    citySlug,
    category,
    pricingModel: pricingModel as PricingModel | undefined,
    minPrice,
    maxPrice,
  });

  function currentQuery(overrides: Partial<PublicServiceFilterValues> = {}) {
    return publicServiceFilterHref('/services', {
      q: search.trim() || undefined,
      regionSlug: selectedRegion || undefined,
      citySlug: cityOptionsLoaded ? selectedCity || undefined : undefined,
      category: selectedCategory || undefined,
      pricingModel: selectedPricingModel || undefined,
      minPrice: selectedMinPrice.trim() || undefined,
      maxPrice: selectedMaxPrice.trim() || undefined,
      ...overrides,
    });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(currentQuery());
  }

  return (
    <form
      onSubmit={submit}
      className="mb-8 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm md:grid-cols-2 xl:grid-cols-[minmax(220px,1fr)_180px_180px_190px_170px_110px_110px_auto] xl:items-end"
    >
      <label className="grid gap-1.5 text-sm font-semibold text-slate-700 md:col-span-2 xl:col-span-1">
        {t('search')}
        <input
          name="q"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-11 rounded-md border border-slate-300 px-3 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-highland focus:ring-2 focus:ring-highland/20"
          placeholder={t('searchPlaceholder')}
        />
      </label>

      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
        {t('region')}
        <select
          name="regionSlug"
          value={selectedRegion}
          onChange={(event) => {
            const nextRegion = event.target.value;
            setSelectedRegion(nextRegion);
            setSelectedCity('');
            router.push(currentQuery({ regionSlug: nextRegion, citySlug: '' }));
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
          value={cityOptionsLoaded ? selectedCity : ''}
          onChange={(event) => {
            const nextCity = event.target.value;
            setSelectedCity(nextCity);
            router.push(currentQuery({ citySlug: nextCity }));
          }}
          disabled={!cityOptionsLoaded}
          className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 focus:border-highland focus:ring-2 focus:ring-highland/20"
        >
          <option value="">{t('allCities')}</option>
          {cityOptionsLoaded
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
          value={selectedCategory}
          onChange={(event) => {
            const nextCategory = event.target.value;
            setSelectedCategory(nextCategory);
            router.push(currentQuery({ category: nextCategory }));
          }}
          className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-highland focus:ring-2 focus:ring-highland/20"
        >
          <option value="">{t('allCategories')}</option>
          {categories.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
        {t('pricing')}
        <select
          name="pricingModel"
          value={selectedPricingModel}
          onChange={(event) => {
            const nextPricingModel = event.target.value;
            setSelectedPricingModel(nextPricingModel as PricingModel | '');
            router.push(
              currentQuery({
                pricingModel: (nextPricingModel || undefined) as
                  PricingModel | undefined,
              }),
            );
          }}
          className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-highland focus:ring-2 focus:ring-highland/20"
        >
          <option value="">{t('anyPricing')}</option>
          {pricingOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
        {t('minPrice')}
        <input
          name="minPrice"
          type="number"
          min="0"
          inputMode="decimal"
          value={selectedMinPrice}
          onChange={(event) => setSelectedMinPrice(event.target.value)}
          className="h-11 rounded-md border border-slate-300 px-3 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-highland focus:ring-2 focus:ring-highland/20"
          placeholder="0"
        />
      </label>

      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
        {t('maxPrice')}
        <input
          name="maxPrice"
          type="number"
          min="0"
          inputMode="decimal"
          value={selectedMaxPrice}
          onChange={(event) => setSelectedMaxPrice(event.target.value)}
          className="h-11 rounded-md border border-slate-300 px-3 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-highland focus:ring-2 focus:ring-highland/20"
          placeholder={t('any')}
        />
      </label>

      <div className="flex h-11 items-center gap-2 md:col-span-2 xl:col-span-1">
        <button className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-md bg-highland px-5 text-sm font-semibold text-white transition hover:bg-highland/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-offset-2">
          <Search className="h-4 w-4" aria-hidden="true" />
          {t('search')}
        </button>
        {hasFilters ? (
          <button
            type="button"
            onClick={() => router.push('/services')}
            className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-highland hover:text-highland focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-offset-2"
          >
            {t('clearFilters')}
          </button>
        ) : null}
      </div>
    </form>
  );
}
