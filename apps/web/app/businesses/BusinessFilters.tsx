'use client';

import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import type { FormEvent } from 'react';
import { useState } from 'react';
import type { Category, LocationSummary } from '../../lib/types';

interface BusinessFiltersProps {
  q: string;
  regionSlug: string;
  citySlug: string;
  category: string;
  regions: LocationSummary[];
  cities: LocationSummary[];
  categories: Category[];
}

function buildQuery(values: {
  q?: string;
  regionSlug?: string;
  citySlug?: string;
  category?: string;
}) {
  const params = new URLSearchParams();
  if (values.q?.trim()) params.set('q', values.q.trim());
  if (values.regionSlug) params.set('regionSlug', values.regionSlug);
  if (values.citySlug) params.set('citySlug', values.citySlug);
  if (values.category) params.set('category', values.category);
  const query = params.toString();
  return query ? `/businesses?${query}` : '/businesses';
}

export function BusinessFilters({
  q,
  regionSlug,
  citySlug,
  category,
  regions,
  cities,
  categories,
}: BusinessFiltersProps) {
  const router = useRouter();
  const [search, setSearch] = useState(q);
  const [selectedRegion, setSelectedRegion] = useState(regionSlug);
  const [selectedCity, setSelectedCity] = useState(citySlug);
  const [selectedCategory, setSelectedCategory] = useState(category);
  const cityOptionsLoaded =
    Boolean(selectedRegion) && selectedRegion === regionSlug;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(
      buildQuery({
        q: search,
        regionSlug: selectedRegion,
        citySlug: cityOptionsLoaded ? selectedCity : '',
        category: selectedCategory,
      }),
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mb-8 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(220px,1fr)_190px_190px_210px_auto] lg:items-end"
    >
      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
        Search
        <input
          name="q"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-11 rounded-md border border-slate-300 px-3 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-highland focus:ring-2 focus:ring-highland/20"
          placeholder="Search businesses"
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
            router.push(
              buildQuery({
                q: search,
                regionSlug: nextRegion,
                category: selectedCategory,
              }),
            );
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
            router.push(
              buildQuery({
                q: search,
                regionSlug: selectedRegion,
                citySlug: nextCity,
                category: selectedCategory,
              }),
            );
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
            router.push(
              buildQuery({
                q: search,
                regionSlug: selectedRegion,
                citySlug: cityOptionsLoaded ? selectedCity : '',
                category: nextCategory,
              }),
            );
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

      <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-highland px-5 text-sm font-semibold text-white transition hover:bg-highland/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-offset-2">
        <Search className="h-4 w-4" aria-hidden="true" />
        Search
      </button>
    </form>
  );
}
