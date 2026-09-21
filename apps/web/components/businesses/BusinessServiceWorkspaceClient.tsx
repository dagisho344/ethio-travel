'use client';

import { useEffect, useMemo, useState } from 'react';
import { getJson } from '../../lib/api';
import {
  canEditBusiness,
  getManagedBusiness,
} from '../../lib/business-management';
import {
  getManagedService,
  operationError,
  updateManagedService,
} from '../../lib/business-operations';
import type {
  ManagedService,
  ManagedServiceInput,
} from '../../lib/business-operations';
import { getServiceCategoryEditor } from '../../lib/service-category-editor';
import type { ServiceCategoryFamily } from '../../lib/service-category-editor';
import type { PaginatedResponse } from '../../lib/types';
import { ServiceWorkspaceHeader } from './ServiceWorkspaceHeader';

type Category = {
  id: string;
  name: string;
  family: ServiceCategoryFamily;
};

type Fields = {
  categoryId: string;
  name: string;
  shortDescription: string;
  description: string;
  pricingModel: string;
  price: string;
  currency: string;
  durationMinutes: string;
};

const paidModels = new Set([
  'FIXED',
  'PER_PERSON',
  'PER_NIGHT',
  'PER_HOUR',
  'PER_DAY',
  'STARTING_FROM',
]);

function fieldsFor(service: ManagedService): Fields {
  return {
    categoryId: service.category.id,
    name: service.name,
    shortDescription: service.shortDescription,
    description: service.description,
    pricingModel: service.pricingModel,
    price: service.price === null ? '' : String(service.price),
    currency: service.currency ?? 'ETB',
    durationMinutes:
      service.durationMinutes === null ? '' : String(service.durationMinutes),
  };
}

export function BusinessServiceWorkspaceClient({
  businessId,
  serviceId,
}: {
  businessId: string;
  serviceId: string;
}) {
  const [service, setService] = useState<ManagedService | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [canWrite, setCanWrite] = useState(false);
  const [fields, setFields] = useState<Fields | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [currentService, categoryPage, business] = await Promise.all([
        getManagedService(businessId, serviceId),
        getJson<PaginatedResponse<Category>>('/service-categories', {
          limit: 100,
        }),
        getManagedBusiness(businessId),
      ]);
      setService(currentService);
      setCategories(categoryPage.data);
      setCanWrite(
        canEditBusiness(business) && currentService.status !== 'ARCHIVED',
      );
      setFields(fieldsFor(currentService));
    } catch (reason) {
      setError(operationError(reason, 'The service workspace could not load.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [businessId, serviceId]);

  const selectedCategory = useMemo(
    () => categories.find((category) => category.id === fields?.categoryId),
    [categories, fields?.categoryId],
  );
  const categoryFamilyChanged = Boolean(
    service &&
    selectedCategory &&
    selectedCategory.family !== service.category.family,
  );

  function change(key: keyof Fields, value: string) {
    setFields((current) => (current ? { ...current, [key]: value } : current));
  }

  function input(): ManagedServiceInput | null {
    if (!fields) return null;
    const price = fields.price.trim() === '' ? null : Number(fields.price);
    const duration =
      fields.durationMinutes.trim() === ''
        ? null
        : Number(fields.durationMinutes);
    const currency = fields.currency.trim().toUpperCase();
    if (
      !fields.categoryId ||
      fields.name.trim().length < 2 ||
      fields.shortDescription.trim().length < 10 ||
      fields.description.trim().length < 10
    ) {
      setError('Complete the required service fields.');
      return null;
    }
    if (
      (price !== null && (!Number.isFinite(price) || price < 0)) ||
      (duration !== null && (!Number.isInteger(duration) || duration < 1))
    ) {
      setError('Enter a valid non-negative price and a whole-number duration.');
      return null;
    }
    if (
      paidModels.has(fields.pricingModel) &&
      (price === null || !/^[A-Z]{3}$/.test(currency))
    ) {
      setError('Paid services need a price and a three-letter currency.');
      return null;
    }
    return {
      categoryId: fields.categoryId,
      name: fields.name.trim(),
      shortDescription: fields.shortDescription.trim(),
      description: fields.description.trim(),
      pricingModel: fields.pricingModel,
      price,
      currency: price === null ? null : currency,
      durationMinutes: duration,
    };
  }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite || saving || !service) return;
    const value = input();
    if (!value) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateManagedService(businessId, service.id, value);
      setService(updated);
      setFields(fieldsFor(updated));
    } catch (reason) {
      setError(operationError(reason, 'The service could not be saved.'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="rounded-md bg-white p-5 text-sm text-slate-500">
        Loading service workspace...
      </p>
    );
  }

  if (!service || !fields) {
    return (
      <p
        role="alert"
        className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
      >
        {error ?? 'The service workspace is unavailable.'}
      </p>
    );
  }

  const editor = getServiceCategoryEditor(service.category.family);

  return (
    <main className="bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-2 sm:px-6">
        <ServiceWorkspaceHeader
          businessId={businessId}
          serviceId={serviceId}
          serviceName={service.name}
          serviceStatus={service.status}
          categoryName={service.category.name}
          categoryFamily={service.category.family}
          canWrite={canWrite}
          currentSection="general"
          description="Manage shared service details, then use the relevant category editor for specialized information."
        />
        {error ? (
          <p
            role="alert"
            className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            {error}
          </p>
        ) : null}
        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-slate-950">
                General details
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Shared Service fields remain separate from category-specific
                prices and configuration.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
              Booking{' '}
              {service.bookingConfig?.enabled ? 'enabled' : 'not configured'}
            </span>
          </div>
          {canWrite ? (
            <form
              onSubmit={(event) => void save(event)}
              className="mt-5 grid gap-4 sm:grid-cols-2"
            >
              <label className="text-sm font-semibold text-slate-700">
                Service category
                <select
                  required
                  disabled={saving}
                  value={fields.categoryId}
                  onChange={(event) => change('categoryId', event.target.value)}
                  className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5 disabled:bg-slate-100"
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Service name
                <input
                  required
                  disabled={saving}
                  maxLength={180}
                  value={fields.name}
                  onChange={(event) => change('name', event.target.value)}
                  className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5 disabled:bg-slate-100"
                />
              </label>
              <label className="sm:col-span-2 text-sm font-semibold text-slate-700">
                Short description
                <input
                  required
                  disabled={saving}
                  minLength={10}
                  maxLength={300}
                  value={fields.shortDescription}
                  onChange={(event) =>
                    change('shortDescription', event.target.value)
                  }
                  className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5 disabled:bg-slate-100"
                />
              </label>
              <label className="sm:col-span-2 text-sm font-semibold text-slate-700">
                Description
                <textarea
                  required
                  disabled={saving}
                  minLength={10}
                  value={fields.description}
                  onChange={(event) =>
                    change('description', event.target.value)
                  }
                  rows={4}
                  className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5 disabled:bg-slate-100"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Pricing model
                <select
                  disabled={saving}
                  value={fields.pricingModel}
                  onChange={(event) =>
                    change('pricingModel', event.target.value)
                  }
                  className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5 disabled:bg-slate-100"
                >
                  {[
                    'FIXED',
                    'PER_PERSON',
                    'PER_NIGHT',
                    'PER_HOUR',
                    'PER_DAY',
                    'STARTING_FROM',
                    'FREE',
                    'CONTACT_FOR_PRICE',
                  ].map((value) => (
                    <option key={value} value={value}>
                      {value.replaceAll('_', ' ')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Price
                <input
                  disabled={saving}
                  inputMode="decimal"
                  value={fields.price}
                  onChange={(event) => change('price', event.target.value)}
                  className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5 disabled:bg-slate-100"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Currency
                <input
                  disabled={saving}
                  maxLength={3}
                  value={fields.currency}
                  onChange={(event) =>
                    change('currency', event.target.value.toUpperCase())
                  }
                  className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5 disabled:bg-slate-100"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Duration in minutes{' '}
                <span className="font-normal">(optional)</span>
                <input
                  disabled={saving}
                  inputMode="numeric"
                  value={fields.durationMinutes}
                  onChange={(event) =>
                    change('durationMinutes', event.target.value)
                  }
                  className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5 disabled:bg-slate-100"
                />
              </label>
              {categoryFamilyChanged ? (
                <p className="sm:col-span-2 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  Changing the category changes which category-specific editor
                  is used. Existing specialized configuration is preserved and
                  is not deleted by this update.
                </p>
              ) : null}
              <div className="sm:col-span-2">
                <button
                  disabled={saving}
                  className="rounded-md bg-highland px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save general details'}
                </button>
              </div>
            </form>
          ) : (
            <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="font-semibold text-slate-700">Description</dt>
                <dd className="mt-1 text-slate-600">{service.description}</dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-700">Pricing</dt>
                <dd className="mt-1 text-slate-600">
                  {service.price === null
                    ? service.pricingModel.replaceAll('_', ' ')
                    : `${service.currency ?? ''} ${service.price}`}
                </dd>
              </div>
            </dl>
          )}
        </section>
        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-bold text-slate-950">
            Category-specific configuration
          </h2>
          {editor ? (
            <p className="mt-2 text-sm text-slate-600">
              {editor.description}. Use {editor.label} to manage this Service's
              specialized data.
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-600">
              No category-specific editor is required for this service.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
