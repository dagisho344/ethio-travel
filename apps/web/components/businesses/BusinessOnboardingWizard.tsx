'use client';

import Link from 'next/link';
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  createBusinessDraft,
  requestErrorMessage,
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
type CategoryOption = { id: string; name: string; code: string };
type DraftFields = {
  name: string;
  categoryId: string;
  description: string;
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

const storageKey = 'ethiotravel:business-onboarding-draft:v1';
const emptyFields: DraftFields = {
  name: '',
  categoryId: '',
  description: '',
  regionId: '',
  cityId: '',
  destinationId: '',
  addressLine1: '',
  addressLine2: '',
  neighborhood: '',
  postalCode: '',
  latitude: '',
  longitude: '',
  phone: '',
  email: '',
  website: '',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readDraft(value: string): Partial<DraftFields> | null {
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) return null;
    const result: Partial<DraftFields> = {};
    for (const key of Object.keys(emptyFields) as Array<keyof DraftFields>) {
      const item = parsed[key];
      if (typeof item === 'string') result[key] = item.slice(0, 20_000);
    }
    return result;
  } catch {
    return null;
  }
}

function inputClass(): string {
  return 'mt-1.5 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-slate-900 outline-none transition focus:border-highland focus:ring-2 focus:ring-highland/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';
}

export function BusinessOnboardingWizard() {
  const t = useTranslations('businessOnboarding');
  const steps = [
    t('basics'),
    t('locationStep'),
    t('contactDetails'),
    t('review'),
  ];
  const [step, setStep] = useState(1);
  const [fields, setFields] = useState<DraftFields>(emptyFields);
  const [regions, setRegions] = useState<RegionOption[]>([]);
  const [cities, setCities] = useState<CityOption[]>([]);
  const [destinations, setDestinations] = useState<DestinationOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingDestinations, setLoadingDestinations] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdBusiness, setCreatedBusiness] =
    useState<ManagedBusiness | null>(null);

  const availableCities = useMemo(
    () => cities.filter((city) => city.regionId === fields.regionId),
    [cities, fields.regionId],
  );
  const selectedRegion = regions.find(
    (region) => region.id === fields.regionId,
  );
  const selectedCity = cities.find((city) => city.id === fields.cityId);
  const selectedCategory = categories.find(
    (category) => category.id === fields.categoryId,
  );
  const selectedDestination = destinations.find(
    (destination) => destination.id === fields.destinationId,
  );

  function updateField<K extends keyof DraftFields>(
    key: K,
    value: DraftFields[K],
  ) {
    setFields((current) => ({ ...current, [key]: value }));
  }

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      const savedFields = saved ? readDraft(saved) : null;
      if (savedFields) setFields((current) => ({ ...current, ...savedFields }));
    } catch {
      // Draft persistence is optional; the form remains usable without browser storage.
    } finally {
      setDraftReady(true);
    }
  }, []);

  useEffect(() => {
    if (!draftReady || createdBusiness) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(fields));
    } catch {
      // Browser storage may be unavailable; no authentication data is stored here.
    }
  }, [createdBusiness, draftReady, fields]);

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
        if (active) setError(t('loadOptionsError'));
      } finally {
        if (active) setLoadingOptions(false);
      }
    }
    void loadOptions();
    return () => {
      active = false;
    };
  }, []);

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
      setLoadingDestinations(true);
      try {
        const page = await getJson<PaginatedResponse<DestinationOption>>(
          `/regions/${regionSlug}/cities/${citySlug}/destinations`,
          { limit: 100 },
        );
        if (active) setDestinations(page.data);
      } catch {
        if (active) setDestinations([]);
      } finally {
        if (active) setLoadingDestinations(false);
      }
    }
    void loadDestinations();
    return () => {
      active = false;
    };
  }, [selectedCity, selectedRegion]);

  function validateStep(targetStep: number): string | null {
    if (targetStep === 1) {
      if (fields.name.trim().length < 2) return t('nameTooShort');
      if (!fields.categoryId) return t('categoryRequired');
      if (fields.description.trim().length < 10)
        return t('descriptionTooShort');
    }
    if (targetStep === 2) {
      if (!fields.regionId || !fields.cityId) return t('regionCityRequired');
      if (fields.addressLine1.trim().length < 2) return t('addressRequired');
      const latitude = Number(fields.latitude);
      const longitude = Number(fields.longitude);
      if (
        !fields.latitude.trim() ||
        !Number.isFinite(latitude) ||
        latitude < -90 ||
        latitude > 90
      )
        return t('latitudeInvalid');
      if (
        !fields.longitude.trim() ||
        !Number.isFinite(longitude) ||
        longitude < -180 ||
        longitude > 180
      )
        return t('longitudeInvalid');
    }
    if (targetStep === 3) {
      if (
        fields.email.trim() &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())
      )
        return t('emailInvalid');
      if (
        fields.website.trim() &&
        !/^https?:\/\/\S+$/i.test(fields.website.trim())
      )
        return t('websiteInvalid');
    }
    return null;
  }

  function next() {
    const validationError = validateStep(step);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setStep((current) => Math.min(current + 1, 4));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError =
      validateStep(1) ?? validateStep(2) ?? validateStep(3);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSubmitting(true);
    setError(null);
    const input: BusinessDraftInput = {
      name: fields.name.trim(),
      categoryId: fields.categoryId,
      description: fields.description.trim(),
      cityId: fields.cityId,
      destinationId: fields.destinationId || undefined,
      addressLine1: fields.addressLine1.trim(),
      addressLine2: fields.addressLine2.trim() || undefined,
      neighborhood: fields.neighborhood.trim() || undefined,
      postalCode: fields.postalCode.trim() || undefined,
      latitude: Number(fields.latitude),
      longitude: Number(fields.longitude),
      phone: fields.phone.trim() || undefined,
      email: fields.email.trim() || undefined,
      website: fields.website.trim() || undefined,
    };
    try {
      const business = await createBusinessDraft(input);
      setCreatedBusiness(business);
      setStep(5);
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // The persisted non-sensitive form draft can expire naturally if storage is unavailable.
      }
    } catch (requestError) {
      setError(requestErrorMessage(requestError, t('createError')));
    } finally {
      setSubmitting(false);
    }
  }

  if (createdBusiness) {
    return (
      <section
        className="rounded-lg border border-emerald-200 bg-white p-6 shadow-sm sm:p-8"
        aria-live="polite"
      >
        <CheckCircle2 className="h-10 w-10 text-highland" aria-hidden="true" />
        <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-highland">
          {t('draftCreated')}
        </p>
        <h2 className="mt-1 text-2xl font-bold text-slate-950">
          {createdBusiness.name}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
          {t('createdDescription', {
            status: createdBusiness.status,
            verification: createdBusiness.verificationSummary.replaceAll(
              '_',
              ' ',
            ),
          })}
        </p>
        <Link
          href={`/businesses/manage/${createdBusiness.id}`}
          className="mt-6 inline-flex rounded-md bg-highland px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
        >
          {t('openWorkspace')}
        </Link>
      </section>
    );
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
    >
      <ol
        className="grid gap-2 border-b border-slate-200 pb-5 sm:grid-cols-4"
        aria-label={t('progress')}
      >
        {steps.map((label, index) => {
          const number = index + 1;
          return (
            <li
              key={label}
              className={`flex items-center gap-2 text-sm font-semibold ${number === step ? 'text-highland' : number < step ? 'text-emerald-700' : 'text-slate-500'}`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs ${number < step ? 'bg-emerald-100' : number === step ? 'bg-emerald-50 ring-1 ring-highland' : 'bg-slate-100'}`}
              >
                {number < step ? '✓' : number}
              </span>
              <span>{label}</span>
            </li>
          );
        })}
      </ol>
      {error ? (
        <p
          role="alert"
          className="mt-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {error}
        </p>
      ) : null}

      {step === 1 ? (
        <section
          className="mt-6 space-y-5"
          aria-labelledby="business-basics-heading"
        >
          <div>
            <h2
              id="business-basics-heading"
              className="text-lg font-bold text-slate-950"
            >
              {t('basics')}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {t('basicsDescription')}
            </p>
          </div>
          <label className="block text-sm font-semibold text-slate-700">
            {t('businessName')}
            <input
              value={fields.name}
              onChange={(event) => updateField('name', event.target.value)}
              maxLength={180}
              required
              className={inputClass()}
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            {t('businessCategory')}
            <select
              value={fields.categoryId}
              onChange={(event) =>
                updateField('categoryId', event.target.value)
              }
              disabled={loadingOptions}
              required
              className={inputClass()}
            >
              <option value="">{t('chooseCategory')}</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            {t('descriptionLabel')}
            <textarea
              value={fields.description}
              onChange={(event) =>
                updateField('description', event.target.value)
              }
              minLength={10}
              maxLength={20_000}
              rows={6}
              required
              className={`${inputClass()} resize-y`}
            />
          </label>
        </section>
      ) : null}

      {step === 2 ? (
        <section
          className="mt-6 space-y-5"
          aria-labelledby="business-location-heading"
        >
          <div>
            <h2
              id="business-location-heading"
              className="text-lg font-bold text-slate-950"
            >
              {t('locationStep')}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {t('locationDescription')}
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              {t('region')}
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
                required
                className={inputClass()}
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
              {t('city')}
              <select
                value={fields.cityId}
                onChange={(event) =>
                  setFields((current) => ({
                    ...current,
                    cityId: event.target.value,
                    destinationId: '',
                  }))
                }
                disabled={!fields.regionId || loadingOptions}
                required
                className={inputClass()}
              >
                <option value="">{t('chooseCity')}</option>
                {availableCities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              {t('destination')}{' '}
              <span className="font-normal text-slate-500">
                ({t('optional')})
              </span>
              <select
                value={fields.destinationId}
                onChange={(event) =>
                  updateField('destinationId', event.target.value)
                }
                disabled={!fields.cityId || loadingDestinations}
                className={inputClass()}
              >
                <option value="">{t('noDestination')}</option>
                {destinations.map((destination) => (
                  <option key={destination.id} value={destination.id}>
                    {destination.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-700">
              {t('neighborhood')}{' '}
              <span className="font-normal text-slate-500">
                ({t('optional')})
              </span>
              <input
                value={fields.neighborhood}
                onChange={(event) =>
                  updateField('neighborhood', event.target.value)
                }
                maxLength={120}
                className={inputClass()}
              />
            </label>
            <label className="sm:col-span-2 text-sm font-semibold text-slate-700">
              {t('addressLine1')}
              <input
                value={fields.addressLine1}
                onChange={(event) =>
                  updateField('addressLine1', event.target.value)
                }
                maxLength={240}
                required
                className={inputClass()}
              />
            </label>
            <label className="sm:col-span-2 text-sm font-semibold text-slate-700">
              {t('addressLine2')}{' '}
              <span className="font-normal text-slate-500">
                ({t('optional')})
              </span>
              <input
                value={fields.addressLine2}
                onChange={(event) =>
                  updateField('addressLine2', event.target.value)
                }
                maxLength={240}
                className={inputClass()}
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              {t('postalCode')}{' '}
              <span className="font-normal text-slate-500">
                ({t('optional')})
              </span>
              <input
                value={fields.postalCode}
                onChange={(event) =>
                  updateField('postalCode', event.target.value)
                }
                maxLength={40}
                className={inputClass()}
              />
            </label>
            <span className="hidden sm:block" />
            <label className="text-sm font-semibold text-slate-700">
              {t('latitude')}
              <input
                inputMode="decimal"
                value={fields.latitude}
                onChange={(event) =>
                  updateField('latitude', event.target.value)
                }
                required
                className={inputClass()}
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              {t('longitude')}
              <input
                inputMode="decimal"
                value={fields.longitude}
                onChange={(event) =>
                  updateField('longitude', event.target.value)
                }
                required
                className={inputClass()}
              />
            </label>
          </div>
        </section>
      ) : null}

      {step === 3 ? (
        <section
          className="mt-6 space-y-5"
          aria-labelledby="business-contact-heading"
        >
          <div>
            <h2
              id="business-contact-heading"
              className="text-lg font-bold text-slate-950"
            >
              {t('contactDetails')}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {t('contactDescription')}
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2">
            <label className="text-sm font-semibold text-slate-700">
              {t('phone')}{' '}
              <span className="font-normal text-slate-500">
                ({t('optional')})
              </span>
              <input
                type="tel"
                value={fields.phone}
                onChange={(event) => updateField('phone', event.target.value)}
                maxLength={40}
                className={inputClass()}
              />
            </label>
            <label className="text-sm font-semibold text-slate-700">
              {t('email')}{' '}
              <span className="font-normal text-slate-500">
                ({t('optional')})
              </span>
              <input
                type="email"
                value={fields.email}
                onChange={(event) => updateField('email', event.target.value)}
                maxLength={254}
                className={inputClass()}
              />
            </label>
            <label className="sm:col-span-2 text-sm font-semibold text-slate-700">
              {t('website')}{' '}
              <span className="font-normal text-slate-500">
                ({t('optional')})
              </span>
              <input
                type="url"
                value={fields.website}
                onChange={(event) => updateField('website', event.target.value)}
                maxLength={2048}
                placeholder="https://example.com"
                className={inputClass()}
              />
            </label>
          </div>
        </section>
      ) : null}

      {step === 4 ? (
        <section className="mt-6" aria-labelledby="business-review-heading">
          <h2
            id="business-review-heading"
            className="text-lg font-bold text-slate-950"
          >
            {t('reviewTitle')}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            {t('reviewDescription')}
          </p>
          <dl className="mt-5 divide-y divide-slate-100 rounded-lg border border-slate-200 text-sm">
            <div className="grid gap-1 p-4 sm:grid-cols-3">
              <dt className="font-semibold text-slate-700">{t('business')}</dt>
              <dd className="sm:col-span-2">{fields.name.trim()}</dd>
            </div>
            <div className="grid gap-1 p-4 sm:grid-cols-3">
              <dt className="font-semibold text-slate-700">{t('category')}</dt>
              <dd className="sm:col-span-2">
                {selectedCategory?.name ?? t('notSelected')}
              </dd>
            </div>
            <div className="grid gap-1 p-4 sm:grid-cols-3">
              <dt className="font-semibold text-slate-700">
                {t('locationStep')}
              </dt>
              <dd className="sm:col-span-2">
                {[
                  selectedRegion?.name,
                  selectedCity?.name,
                  selectedDestination?.name,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                <br />
                {fields.addressLine1}
              </dd>
            </div>
            <div className="grid gap-1 p-4 sm:grid-cols-3">
              <dt className="font-semibold text-slate-700">{t('contact')}</dt>
              <dd className="sm:col-span-2">
                {[fields.phone, fields.email, fields.website]
                  .filter(Boolean)
                  .join(' · ') || t('noContact')}
              </dd>
            </div>
          </dl>
          <p className="mt-5 rounded-md bg-slate-50 p-4 text-sm leading-6 text-slate-600">
            {t('draftOwnership')}
          </p>
        </section>
      ) : null}

      <div className="mt-7 flex flex-col-reverse gap-3 border-t border-slate-200 pt-5 sm:flex-row sm:justify-between">
        <button
          type="button"
          onClick={() => {
            setError(null);
            setStep((current) => Math.max(1, current - 1));
          }}
          disabled={step === 1 || submitting}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          {t('back')}
        </button>
        {step < 4 ? (
          <button
            type="button"
            onClick={next}
            disabled={loadingOptions}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-highland px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {t('continue')}
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="submit"
            disabled={submitting || loadingOptions}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-highland px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <>
                <LoaderCircle
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
                {t('creating')}
              </>
            ) : (
              t('createDraft')
            )}
          </button>
        )}
      </div>
    </form>
  );
}
