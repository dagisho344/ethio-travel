'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { BffRequestError, bffJson } from '../../lib/private-api';
import { getJson } from '../../lib/api';
import { isValidCalendarDate } from '../../lib/trips';
import type { PaginatedResponse, Trip } from '../../lib/types';

type RegionOption = { id: string; name: string; slug: string };
type CityOption = { id: string; name: string; slug: string; regionId: string };
type DestinationOption = { id: string; name: string; slug: string };

export function CreateTripForm() {
  const t = useTranslations('trips');
  const router = useRouter();
  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [cities, setCities] = useState<CityOption[]>([]);
  const [destinations, setDestinations] = useState<DestinationOption[]>([]);
  const [title, setTitle] = useState('');
  const [originCityId, setOriginCityId] = useState('');
  const [destinationRegionId, setDestinationRegionId] = useState('');
  const [destinationCityId, setDestinationCityId] = useState('');
  const [primaryDestinationId, setPrimaryDestinationId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const destinationCities = useMemo(
    () => cities.filter((city) => city.regionId === destinationRegionId),
    [cities, destinationRegionId],
  );
  const selectedDestinationCity = cities.find(
    (city) => city.id === destinationCityId,
  );
  const selectedDestinationRegion = regions.find(
    (region) => region.id === destinationRegionId,
  );

  useEffect(() => {
    let current = true;
    const load = async () => {
      setLoadingLocations(true);
      try {
        const [regionPage, cityPage] = await Promise.all([
          getJson<PaginatedResponse<RegionOption>>('/regions', { limit: 100 }),
          getJson<PaginatedResponse<CityOption>>('/cities', { limit: 100 }),
        ]);
        if (!current) return;
        setRegions(regionPage.data);
        setCities(cityPage.data);
      } catch {
        if (current) setError(t('locationsLoadError'));
      } finally {
        if (current) setLoadingLocations(false);
      }
    };
    void load();
    return () => {
      current = false;
    };
  }, [t]);

  useEffect(() => {
    let current = true;
    if (!selectedDestinationCity || !selectedDestinationRegion) {
      setDestinations([]);
      return () => {
        current = false;
      };
    }
    const load = async () => {
      try {
        const page = await getJson<PaginatedResponse<DestinationOption>>(
          `/regions/${selectedDestinationRegion.slug}/cities/${selectedDestinationCity.slug}/destinations`,
          { limit: 100 },
        );
        if (current) setDestinations(page.data);
      } catch {
        if (current) setDestinations([]);
      }
    };
    void load();
    return () => {
      current = false;
    };
  }, [selectedDestinationCity, selectedDestinationRegion]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError(t('titleRequired'));
      return;
    }
    if (!isValidCalendarDate(startDate) || !isValidCalendarDate(endDate)) {
      setError(t('invalidDates'));
      return;
    }
    if (startDate > endDate) {
      setError(t('endBeforeStart'));
      return;
    }
    setSubmitting(true);
    try {
      const trip = await bffJson<Trip>('/api/trips', {
        method: 'POST',
        body: JSON.stringify({
          title: trimmedTitle,
          originCityId: originCityId || undefined,
          destinationCityId: destinationCityId || undefined,
          primaryDestinationId: primaryDestinationId || undefined,
          startDate,
          endDate,
          notes: notes.trim() || undefined,
        }),
      });
      router.push(`/trips/${trip.id}`);
    } catch (requestError) {
      setError(
        requestError instanceof BffRequestError && requestError.status === 401
          ? t('sessionEnded')
          : t('createError'),
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="mt-8 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
    >
      {error ? (
        <p
          role="alert"
          className="mb-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {error}
        </p>
      ) : null}
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="sm:col-span-2 text-sm font-semibold text-slate-700">
          {t('titleLabel')}
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={160}
            required
            placeholder={t('titlePlaceholder')}
            className="mt-1.5 block w-full rounded-md border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-highland focus:ring-2 focus:ring-highland/20"
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          {t('originCity')}{' '}
          <span className="font-normal text-slate-500">({t('optional')})</span>
          <select
            value={originCityId}
            onChange={(event) => setOriginCityId(event.target.value)}
            disabled={loadingLocations}
            className="mt-1.5 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-highland focus:ring-2 focus:ring-highland/20 disabled:opacity-60"
          >
            <option value="">{t('chooseOrigin')}</option>
            {cities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          {t('destinationRegion')}{' '}
          <span className="font-normal text-slate-500">({t('optional')})</span>
          <select
            value={destinationRegionId}
            onChange={(event) => {
              setDestinationRegionId(event.target.value);
              setDestinationCityId('');
              setPrimaryDestinationId('');
            }}
            disabled={loadingLocations}
            className="mt-1.5 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-highland focus:ring-2 focus:ring-highland/20 disabled:opacity-60"
          >
            <option value="">{t('chooseRegion')}</option>
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          {t('destinationCity')}
          <select
            value={destinationCityId}
            onChange={(event) => {
              setDestinationCityId(event.target.value);
              setPrimaryDestinationId('');
            }}
            disabled={!destinationRegionId || loadingLocations}
            className="mt-1.5 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-highland focus:ring-2 focus:ring-highland/20 disabled:opacity-60"
          >
            <option value="">{t('chooseDestinationCity')}</option>
            {destinationCities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          {t('primaryDestination')}
          <select
            value={primaryDestinationId}
            onChange={(event) => setPrimaryDestinationId(event.target.value)}
            disabled={!destinationCityId}
            className="mt-1.5 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-highland focus:ring-2 focus:ring-highland/20 disabled:opacity-60"
          >
            <option value="">{t('chooseDestination')}</option>
            {destinations.map((destination) => (
              <option key={destination.id} value={destination.id}>
                {destination.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          {t('startDate')}
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            required
            className="mt-1.5 block w-full rounded-md border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-highland focus:ring-2 focus:ring-highland/20"
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          {t('endDate')}
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            required
            className="mt-1.5 block w-full rounded-md border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-highland focus:ring-2 focus:ring-highland/20"
          />
        </label>
        <label className="sm:col-span-2 text-sm font-semibold text-slate-700">
          {t('notes')}{' '}
          <span className="font-normal text-slate-500">({t('optional')})</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={2000}
            rows={4}
            placeholder={t('notes')}
            className="mt-1.5 block w-full resize-y rounded-md border border-slate-300 px-3 py-2.5 text-slate-900 outline-none focus:border-highland focus:ring-2 focus:ring-highland/20"
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={submitting || loadingLocations}
        className="mt-6 inline-flex rounded-md bg-highland px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? t('creating') : t('create')}
      </button>
    </form>
  );
}
