'use client';

import { LoaderCircle } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  canEditBusiness,
  requestErrorMessage,
  updateManagedBusiness,
} from '../../lib/business-management';
import type {
  BusinessDraftInput,
  ManagedBusiness,
} from '../../lib/business-management';
import { getJson } from '../../lib/api';
import type { PaginatedResponse } from '../../lib/types';
type RegionOption = { id: string; name: string; slug: string };
type CityOption = { id: string; name: string; slug: string; regionId: string };
type DestinationOption = { id: string; name: string; slug: string };
type CategoryOption = { id: string; name: string };
type ProfileFields = {
  name: string;
  description: string;
  categoryId: string;
  regionId: string;
  cityId: string;
  destinationId: string;
  addressLine1: string;
  addressLine2: string;
  neighborhood: string;
  postalCode: string;
  latitude: string;
  longitude: string;
  phone: string;
  email: string;
  website: string;
};

function formFields(business: ManagedBusiness): ProfileFields {
  return {
    name: business.name,
    description: business.description,
    categoryId: business.category.id,
    regionId: business.city.region.id,
    cityId: business.city.id,
    destinationId: business.destination?.id ?? '',
    addressLine1: business.addressLine1,
    addressLine2: business.addressLine2 ?? '',
    neighborhood: business.neighborhood ?? '',
    postalCode: business.postalCode ?? '',
    latitude: String(business.latitude),
    longitude: String(business.longitude),
    phone: business.phone ?? '',
    email: business.email ?? '',
    website: business.website ?? '',
  };
}

function inputClass(): string {
  return 'mt-1.5 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none focus:border-highland focus:ring-2 focus:ring-highland/20 disabled:cursor-not-allowed disabled:bg-slate-100';
}

export function BusinessProfileEditor({
  business,
  onSaved,
}: {
  business: ManagedBusiness;
  onSaved: () => Promise<void>;
}) {
  const [fields, setFields] = useState<ProfileFields>(() =>
    formFields(business),
  );
  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [cities, setCities] = useState<CityOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [destinations, setDestinations] = useState<DestinationOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canEdit = canEditBusiness(business);
  const availableCities = useMemo(
    () => cities.filter((city) => city.regionId === fields.regionId),
    [cities, fields.regionId],
  );
  const selectedRegion = regions.find(
    (region) => region.id === fields.regionId,
  );
  const selectedCity = cities.find((city) => city.id === fields.cityId);

  useEffect(() => {
    setFields(formFields(business));
  }, [business]);

  useEffect(() => {
    let active = true;
    async function loadOptions() {
      setLoadingOptions(true);
      try {
        const [regionPage, cityPage, categoryPage] = await Promise.all([
          getJson<PaginatedResponse<RegionOption>>('/regions', { limit: 100 }),
          getJson<PaginatedResponse<CityOption>>('/cities', { limit: 100 }),
          getJson<PaginatedResponse<CategoryOption>>('/business-categories', {
            limit: 100,
          }),
        ]);
        if (!active) return;
        setRegions(regionPage.data);
        setCities(cityPage.data);
        setCategories(categoryPage.data);
      } catch {
        if (active)
          setError(
            'Profile options could not be loaded. You can try again later.',
          );
      } finally {
        if (active) setLoadingOptions(false);
      }
    }
    if (canEdit) void loadOptions();
    return () => {
      active = false;
    };
  }, [canEdit]);

  useEffect(() => {
    let active = true;
    const regionSlug = selectedRegion?.slug;
    const citySlug = selectedCity?.slug;
    if (!regionSlug || !citySlug) {
      setDestinations([]);
      return () => {
        active = false;
      };
    }
    async function loadDestinations() {
      try {
        const result = await getJson<PaginatedResponse<DestinationOption>>(
          `/regions/${regionSlug}/cities/${citySlug}/destinations`,
          { limit: 100 },
        );
        if (active) setDestinations(result.data);
      } catch {
        if (active) setDestinations([]);
      }
    }
    if (canEdit) void loadDestinations();
    return () => {
      active = false;
    };
  }, [canEdit, selectedCity, selectedRegion]);

  function update<K extends keyof ProfileFields>(
    key: K,
    value: ProfileFields[K],
  ) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canEdit || saving) return;
    if (
      fields.name.trim().length < 2 ||
      fields.description.trim().length < 10 ||
      !fields.categoryId ||
      !fields.cityId ||
      fields.addressLine1.trim().length < 2
    ) {
      setError('Complete the required business, category and location fields.');
      return;
    }
    const latitude = Number(fields.latitude);
    const longitude = Number(fields.longitude);
    if (
      !Number.isFinite(latitude) ||
      latitude < -90 ||
      latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 ||
      longitude > 180
    ) {
      setError('Enter valid latitude and longitude values.');
      return;
    }
    setSaving(true);
    setError(null);
    const input: BusinessDraftInput = {
      name: fields.name.trim(),
      description: fields.description.trim(),
      categoryId: fields.categoryId,
      cityId: fields.cityId,
      destinationId: fields.destinationId || undefined,
      addressLine1: fields.addressLine1.trim(),
      addressLine2: fields.addressLine2.trim() || undefined,
      neighborhood: fields.neighborhood.trim() || undefined,
      postalCode: fields.postalCode.trim() || undefined,
      latitude,
      longitude,
      phone: fields.phone.trim() || undefined,
      email: fields.email.trim() || undefined,
      website: fields.website.trim() || undefined,
    };
    try {
      await updateManagedBusiness(business.id, input);
      await onSaved();
    } catch (requestError) {
      setError(
        requestErrorMessage(
          requestError,
          'We could not update this business profile.',
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-slate-950">Profile</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {business.currentMember.role === 'STAFF'
            ? 'Staff members can view this workspace but cannot change business details.'
            : 'Archived businesses are read-only.'}
        </p>
      </section>
    );
  }

  return (
    <form
      onSubmit={(event) => void save(event)}
      className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
      aria-labelledby="profile-heading"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="profile-heading" className="text-lg font-bold text-slate-950">
            Edit profile
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Owner and manager changes are authorized again by the backend.
          </p>
        </div>
      </div>
      {error ? (
        <p
          role="alert"
          className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {error}
        </p>
      ) : null}
      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <label className="sm:col-span-2 text-sm font-semibold text-slate-700">
          Business name
          <input
            value={fields.name}
            onChange={(event) => update('name', event.target.value)}
            maxLength={180}
            required
            className={inputClass()}
          />
        </label>
        <label className="sm:col-span-2 text-sm font-semibold text-slate-700">
          Description
          <textarea
            value={fields.description}
            onChange={(event) => update('description', event.target.value)}
            minLength={10}
            maxLength={20_000}
            rows={5}
            required
            className={`${inputClass()} resize-y`}
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Category
          <select
            value={fields.categoryId}
            onChange={(event) => update('categoryId', event.target.value)}
            disabled={loadingOptions}
            required
            className={inputClass()}
          >
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Region
          <select
            value={fields.regionId}
            onChange={(event) =>
              setFields((current) => ({
                ...current,
                regionId: event.target.value,
                cityId: '',
                destinationId: '',
              }))
            }
            disabled={loadingOptions}
            className={inputClass()}
          >
            {regions.map((region) => (
              <option key={region.id} value={region.id}>
                {region.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          City
          <select
            value={fields.cityId}
            onChange={(event) =>
              setFields((current) => ({
                ...current,
                cityId: event.target.value,
                destinationId: '',
              }))
            }
            disabled={loadingOptions || !fields.regionId}
            required
            className={inputClass()}
          >
            {availableCities.map((city) => (
              <option key={city.id} value={city.id}>
                {city.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Destination{' '}
          <span className="font-normal text-slate-500">(optional)</span>
          <select
            value={fields.destinationId}
            onChange={(event) => update('destinationId', event.target.value)}
            disabled={!fields.cityId}
            className={inputClass()}
          >
            <option value="">No destination selected</option>
            {destinations.map((destination) => (
              <option key={destination.id} value={destination.id}>
                {destination.name}
              </option>
            ))}
          </select>
        </label>
        <label className="sm:col-span-2 text-sm font-semibold text-slate-700">
          Address line 1
          <input
            value={fields.addressLine1}
            onChange={(event) => update('addressLine1', event.target.value)}
            maxLength={240}
            required
            className={inputClass()}
          />
        </label>
        <label className="sm:col-span-2 text-sm font-semibold text-slate-700">
          Address line 2{' '}
          <span className="font-normal text-slate-500">(optional)</span>
          <input
            value={fields.addressLine2}
            onChange={(event) => update('addressLine2', event.target.value)}
            maxLength={240}
            className={inputClass()}
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Neighborhood{' '}
          <span className="font-normal text-slate-500">(optional)</span>
          <input
            value={fields.neighborhood}
            onChange={(event) => update('neighborhood', event.target.value)}
            maxLength={120}
            className={inputClass()}
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Postal code{' '}
          <span className="font-normal text-slate-500">(optional)</span>
          <input
            value={fields.postalCode}
            onChange={(event) => update('postalCode', event.target.value)}
            maxLength={40}
            className={inputClass()}
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Latitude
          <input
            inputMode="decimal"
            value={fields.latitude}
            onChange={(event) => update('latitude', event.target.value)}
            className={inputClass()}
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Longitude
          <input
            inputMode="decimal"
            value={fields.longitude}
            onChange={(event) => update('longitude', event.target.value)}
            className={inputClass()}
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Phone <span className="font-normal text-slate-500">(optional)</span>
          <input
            type="tel"
            value={fields.phone}
            onChange={(event) => update('phone', event.target.value)}
            maxLength={40}
            className={inputClass()}
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          Email <span className="font-normal text-slate-500">(optional)</span>
          <input
            type="email"
            value={fields.email}
            onChange={(event) => update('email', event.target.value)}
            maxLength={254}
            className={inputClass()}
          />
        </label>
        <label className="sm:col-span-2 text-sm font-semibold text-slate-700">
          Website <span className="font-normal text-slate-500">(optional)</span>
          <input
            type="url"
            value={fields.website}
            onChange={(event) => update('website', event.target.value)}
            maxLength={2048}
            className={inputClass()}
          />
        </label>
      </div>
      <button
        type="submit"
        disabled={saving || loadingOptions}
        className="mt-6 inline-flex items-center gap-2 rounded-md bg-highland px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving ? (
          <>
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            Saving...
          </>
        ) : (
          'Save profile'
        )}
      </button>
    </form>
  );
}
