'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getJson } from '../../lib/api';
import {
  canEditBusiness,
  getManagedBusiness,
} from '../../lib/business-management';
import {
  createManagedService,
  getManagedServices,
  operationError,
  serviceAction,
} from '../../lib/business-operations';
import type {
  ManagedService,
  ManagedServiceInput,
} from '../../lib/business-operations';
import {
  getServiceCategoryEditor,
  serviceCategoryEditorPath,
} from '../../lib/service-category-editor';
import type { PaginatedResponse } from '../../lib/types';

type Category = {
  id: string;
  name: string;
  family: ManagedService['category']['family'];
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
const blank = (): Fields => ({
  categoryId: '',
  name: '',
  shortDescription: '',
  description: '',
  pricingModel: 'FIXED',
  price: '',
  currency: 'ETB',
  durationMinutes: '',
});
const paidModels = new Set([
  'FIXED',
  'PER_PERSON',
  'PER_NIGHT',
  'PER_HOUR',
  'PER_DAY',
  'STARTING_FROM',
]);

export function BusinessServicesClient({ businessId }: { businessId: string }) {
  const [services, setServices] = useState<ManagedService[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [canWrite, setCanWrite] = useState(false);
  const [fields, setFields] = useState<Fields>(blank);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [servicePage, categoryPage, business] = await Promise.all([
        getManagedServices(businessId),
        getJson<PaginatedResponse<Category>>('/service-categories', {
          limit: 100,
        }),
        getManagedBusiness(businessId),
      ]);
      setServices(servicePage.data);
      setCategories(categoryPage.data);
      setCanWrite(canEditBusiness(business));
    } catch (reason) {
      setError(operationError(reason, 'Services could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [businessId]);
  function change(key: keyof Fields, value: string) {
    setFields((current) => ({ ...current, [key]: value }));
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite || saving) return;
    const price = fields.price.trim() === '' ? null : Number(fields.price);
    const duration =
      fields.durationMinutes.trim() === ''
        ? null
        : Number(fields.durationMinutes);
    if (
      !fields.categoryId ||
      fields.name.trim().length < 2 ||
      fields.shortDescription.trim().length < 10 ||
      fields.description.trim().length < 10
    ) {
      setError('Complete the required service fields.');
      return;
    }
    if (
      (price !== null && (!Number.isFinite(price) || price < 0)) ||
      (duration !== null && (!Number.isInteger(duration) || duration < 1))
    ) {
      setError('Enter a valid non-negative price and a whole-number duration.');
      return;
    }
    if (
      paidModels.has(fields.pricingModel) &&
      (price === null || !/^[A-Z]{3}$/.test(fields.currency.trim()))
    ) {
      setError('Paid services need a price and a three-letter currency.');
      return;
    }
    const input: ManagedServiceInput = {
      categoryId: fields.categoryId,
      name: fields.name.trim(),
      shortDescription: fields.shortDescription.trim(),
      description: fields.description.trim(),
      pricingModel: fields.pricingModel,
      price,
      currency: price === null ? null : fields.currency.trim().toUpperCase(),
      durationMinutes: duration,
    };
    setSaving(true);
    setError(null);
    try {
      await createManagedService(businessId, input);
      setFields(blank());
      await load();
    } catch (reason) {
      setError(operationError(reason, 'The service could not be saved.'));
    } finally {
      setSaving(false);
    }
  }
  async function action(
    service: ManagedService,
    name: 'publish' | 'unpublish' | 'archive',
  ) {
    if (!canWrite) return;
    setSaving(true);
    setError(null);
    try {
      await serviceAction(businessId, service.id, name);
      await load();
    } catch (reason) {
      setError(operationError(reason, 'The service lifecycle change failed.'));
    } finally {
      setSaving(false);
    }
  }
  return (
    <main className="bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-950">Services</h1>
            <p className="mt-1 text-sm text-slate-600">
              Manage real services and their booking availability.
            </p>
          </div>
          <Link
            href={`/businesses/manage/${businessId}`}
            className="text-sm font-semibold text-highland"
          >
            Back to workspace
          </Link>
        </div>
        {error ? (
          <p
            role="alert"
            className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            {error}
          </p>
        ) : null}
        {canWrite ? (
          <form
            onSubmit={(event) => void save(event)}
            className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div>
              <h2 className="text-lg font-bold text-slate-950">Add service</h2>
              <p className="mt-1 text-sm text-slate-600">
                Create a shared Service first, then manage its category details
                from its Service workspace.
              </p>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-semibold text-slate-700">
                Service category
                <select
                  required
                  value={fields.categoryId}
                  onChange={(event) => change('categoryId', event.target.value)}
                  className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5"
                >
                  <option value="">Select a category</option>
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
                  maxLength={180}
                  value={fields.name}
                  onChange={(event) => change('name', event.target.value)}
                  className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5"
                />
              </label>
              <label className="sm:col-span-2 text-sm font-semibold text-slate-700">
                Short description
                <input
                  required
                  minLength={10}
                  maxLength={300}
                  value={fields.shortDescription}
                  onChange={(event) =>
                    change('shortDescription', event.target.value)
                  }
                  className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5"
                />
              </label>
              <label className="sm:col-span-2 text-sm font-semibold text-slate-700">
                Description
                <textarea
                  required
                  minLength={10}
                  value={fields.description}
                  onChange={(event) =>
                    change('description', event.target.value)
                  }
                  rows={4}
                  className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Pricing model
                <select
                  value={fields.pricingModel}
                  onChange={(event) =>
                    change('pricingModel', event.target.value)
                  }
                  className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5"
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
                  inputMode="decimal"
                  value={fields.price}
                  onChange={(event) => change('price', event.target.value)}
                  className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Currency
                <input
                  maxLength={3}
                  value={fields.currency}
                  onChange={(event) =>
                    change('currency', event.target.value.toUpperCase())
                  }
                  className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5"
                />
              </label>
              <label className="text-sm font-semibold text-slate-700">
                Duration in minutes{' '}
                <span className="font-normal">(optional)</span>
                <input
                  inputMode="numeric"
                  value={fields.durationMinutes}
                  onChange={(event) =>
                    change('durationMinutes', event.target.value)
                  }
                  className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5"
                />
              </label>
            </div>
            <button
              disabled={saving}
              className="mt-5 rounded-md bg-highland px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Create service'}
            </button>
          </form>
        ) : (
          <p className="mt-6 rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">
            Staff can inspect services but cannot change service or availability
            settings.
          </p>
        )}
        <section className="mt-6 space-y-4">
          {loading ? (
            <p className="rounded-md bg-white p-5 text-sm text-slate-500">
              Loading services...
            </p>
          ) : services.length ? (
            services.map((service) => {
              const categoryEditor = getServiceCategoryEditor(
                service.category.family,
              );
              const categoryEditorPath = serviceCategoryEditorPath(
                businessId,
                service.id,
                service.category.family,
              );
              return (
                <article
                  key={service.id}
                  className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex flex-wrap justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-500">
                        {service.status}
                      </p>
                      <h2 className="mt-1 text-lg font-bold text-slate-950">
                        {service.name}
                      </h2>
                      <p className="mt-1 text-sm text-slate-600">
                        {service.category.name}
                        {' \u00b7 '}
                        {service.shortDescription}
                      </p>
                    </div>
                    <p className="text-sm font-semibold text-slate-700">
                      {service.price === null
                        ? service.pricingModel.replaceAll('_', ' ')
                        : `${service.currency ?? ''} ${service.price}`}
                    </p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link
                      href={`/businesses/manage/${businessId}/services/${service.id}`}
                      className="rounded-md bg-highland px-3 py-2 text-sm font-semibold text-white hover:bg-highland/90 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
                    >
                      Manage Service
                    </Link>
                    {categoryEditor && categoryEditorPath ? (
                      <Link
                        href={categoryEditorPath}
                        className="rounded-md border border-emerald-200 px-3 py-2 text-sm font-semibold text-emerald-800 hover:border-highland hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
                      >
                        {categoryEditor.label}
                      </Link>
                    ) : null}
                    <Link
                      href={`/businesses/manage/${businessId}/services/${service.id}/availability`}
                      className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-highland hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
                    >
                      Availability
                    </Link>
                    {canWrite && service.status !== 'ARCHIVED' ? (
                      <>
                        {service.status === 'PUBLISHED' ? (
                          <button
                            type="button"
                            onClick={() => void action(service, 'unpublish')}
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => void action(service, 'publish')}
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                          >
                            Publish
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => void action(service, 'archive')}
                          className="rounded-md border border-red-200 px-3 py-2 text-sm font-semibold text-red-800"
                        >
                          Archive
                        </button>
                      </>
                    ) : null}
                  </div>
                </article>
              );
            })
          ) : (
            <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
              No services have been created yet.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
