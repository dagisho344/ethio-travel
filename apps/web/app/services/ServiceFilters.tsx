'use client';

import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import type { FormEvent } from 'react';
import { useState } from 'react';
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

const pricingOptions: { value: PricingModel; label: string }[] = [
  { value: 'FREE', label: 'Free' },
  { value: 'CONTACT_FOR_PRICE', label: 'Contact for price' },
  { value: 'FIXED', label: 'Fixed price' },
  { value: 'PER_PERSON', label: 'Per person' },
  { value: 'PER_NIGHT', label: 'Per night' },
  { value: 'PER_HOUR', label: 'Per hour' },
  { value: 'PER_DAY', label: 'Per day' },
  { value: 'STARTING_FROM', label: 'Starting from' },
];

function cleanAmount(value: string) {
  if (!value.trim()) return undefined;
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? String(amount) : undefined;
}

function buildQuery(values: {
  q?: string;
  regionSlug?: string;
  citySlug?: string;
  category?: string;
  pricingModel?: string;
  minPrice?: string;
  maxPrice?: string;
}) {
  const params = new URLSearchParams();
  if (values.q?.trim()) params.set('q', values.q.trim());
  if (values.regionSlug) params.set('regionSlug', values.regionSlug);
  if (values.citySlug) params.set('citySlug', values.citySlug);
  if (values.category) params.set('category', values.category);
  if (values.pricingModel) params.set('pricingModel', values.pricingModel);
  const minPrice = cleanAmount(values.minPrice ?? '');
  const maxPrice = cleanAmount(values.maxPrice ?? '');
  if (minPrice) params.set('minPrice', minPrice);
  if (maxPrice) params.set('maxPrice', maxPrice);
  const query = params.toString();
  return query ? `/services?${query}` : '/services';
}

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
  const router = useRouter();
  const [search, setSearch] = useState(q);
  const [selectedRegion, setSelectedRegion] = useState(regionSlug);
  const [selectedCity, setSelectedCity] = useState(citySlug);
  const [selectedCategory, setSelectedCategory] = useState(category);
  const [selectedPricingModel, setSelectedPricingModel] =
    useState(pricingModel);
  const [selectedMinPrice, setSelectedMinPrice] = useState(minPrice);
  const [selectedMaxPrice, setSelectedMaxPrice] = useState(maxPrice);
  const cityOptionsLoaded =
    Boolean(selectedRegion) && selectedRegion === regionSlug;

  function currentQuery(
    overrides: Partial<Parameters<typeof buildQuery>[0]> = {},
  ) {
    return buildQuery({
      q: search,
      regionSlug: selectedRegion,
      citySlug: cityOptionsLoaded ? selectedCity : '',
      category: selectedCategory,
      pricingModel: selectedPricingModel,
      minPrice: selectedMinPrice,
      maxPrice: selectedMaxPrice,
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
        Search
        <input
          name="q"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-11 rounded-md border border-slate-300 px-3 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-highland focus:ring-2 focus:ring-highland/20"
          placeholder="Search services"
        />
      </label>

      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
        Region
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
          <option value="">All regions</option>
          {regions.map((region) => (
            <option key={region.slug} value={region.slug}>
              {region.name}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
        City
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
          <option value="">All cities</option>
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
        Category
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
          <option value="">All categories</option>
          {categories.map((item) => (
            <option key={item.code} value={item.code}>
              {item.name}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
        Pricing
        <select
          name="pricingModel"
          value={selectedPricingModel}
          onChange={(event) => {
            const nextPricingModel = event.target.value;
            setSelectedPricingModel(nextPricingModel);
            router.push(currentQuery({ pricingModel: nextPricingModel }));
          }}
          className="h-11 rounded-md border border-slate-300 bg-white px-3 text-sm font-normal text-slate-900 outline-none transition focus:border-highland focus:ring-2 focus:ring-highland/20"
        >
          <option value="">Any pricing</option>
          {pricingOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
        Min price
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
        Max price
        <input
          name="maxPrice"
          type="number"
          min="0"
          inputMode="decimal"
          value={selectedMaxPrice}
          onChange={(event) => setSelectedMaxPrice(event.target.value)}
          className="h-11 rounded-md border border-slate-300 px-3 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-highland focus:ring-2 focus:ring-highland/20"
          placeholder="Any"
        />
      </label>

      <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-highland px-5 text-sm font-semibold text-white transition hover:bg-highland/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-offset-2 md:col-span-2 xl:col-span-1">
        <Search className="h-4 w-4" aria-hidden="true" />
        Search
      </button>
    </form>
  );
}
