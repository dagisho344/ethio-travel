'use client';

import { useRouter } from 'next/navigation';
import { Search } from 'lucide-react';
import type { FormEvent } from 'react';
import { useState } from 'react';
import type { LocationSummary } from '../../lib/types';

interface DestinationFiltersProps {
  q: string;
  regionSlug: string;
  citySlug: string;
  regions: LocationSummary[];
  cities: LocationSummary[];
}

function buildQuery(values: {
  q?: string;
  regionSlug?: string;
  citySlug?: string;
}) {
  const params = new URLSearchParams();
  if (values.q?.trim()) params.set('q', values.q.trim());
  if (values.regionSlug) params.set('regionSlug', values.regionSlug);
  if (values.citySlug) params.set('citySlug', values.citySlug);
  const query = params.toString();
  return query ? `/destinations?${query}` : '/destinations';
}

export function DestinationFilters({
  q,
  regionSlug,
  citySlug,
  regions,
  cities,
}: DestinationFiltersProps) {
  const router = useRouter();
  const [search, setSearch] = useState(q);
  const [selectedRegion, setSelectedRegion] = useState(regionSlug);
  const [selectedCity, setSelectedCity] = useState(citySlug);
  const cityOptionsLoaded =
    Boolean(selectedRegion) && selectedRegion === regionSlug;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    router.push(
      buildQuery({
        q: search,
        regionSlug: selectedRegion,
        citySlug: cityOptionsLoaded ? selectedCity : '',
      }),
    );
  }

  return (
    <form
      onSubmit={submit}
      className="mb-8 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm lg:grid-cols-[minmax(220px,1fr)_220px_220px_auto] lg:items-end"
    >
      <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
        Search
        <input
          name="q"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-11 rounded-md border border-slate-300 px-3 text-sm font-normal text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-highland focus:ring-2 focus:ring-highland/20"
          placeholder="Search destinations"
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
            router.push(buildQuery({ q: search, regionSlug: nextRegion }));
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

      <button className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-highland px-5 text-sm font-semibold text-white transition hover:bg-highland/90 focus:outline-none focus-visible:ring-2 focus-visible:ring-highland focus-visible:ring-offset-2">
        <Search className="h-4 w-4" aria-hidden="true" />
        Search
      </button>
    </form>
  );
}
