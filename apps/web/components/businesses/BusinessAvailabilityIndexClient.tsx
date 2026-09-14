'use client';

import Link from 'next/link';
import { CalendarClock, LoaderCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
  getManagedServices,
  operationError,
} from '../../lib/business-operations';
import type { ManagedService } from '../../lib/business-operations';

export function BusinessAvailabilityIndexClient({
  businessId,
}: {
  businessId: string;
}) {
  const [services, setServices] = useState<ManagedService[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getManagedServices(businessId)
      .then((page) => {
        if (active) setServices(page.data);
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(operationError(reason, 'Availability could not be loaded.'));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [businessId]);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-950">Availability</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Select a service to manage its existing booking configuration,
            weekly rules, and date-specific overrides.
          </p>
        </div>
        <Link
          href={`/businesses/manage/${businessId}/services`}
          className="inline-flex w-fit items-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-highland hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
        >
          Manage services
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
      {loading ? (
        <p className="mt-5 flex items-center gap-2 rounded-md bg-slate-50 p-5 text-sm text-slate-500">
          <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading services…
        </p>
      ) : services.length ? (
        <ul className="mt-5 divide-y divide-slate-100 rounded-md border border-slate-200">
          {services.map((service) => (
            <li
              key={service.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-950">{service.name}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {service.status} ·{' '}
                  {service.bookingConfig?.enabled
                    ? 'Booking enabled'
                    : 'Booking not enabled'}
                </p>
              </div>
              <Link
                href={`/businesses/manage/${businessId}/services/${service.id}/availability`}
                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md bg-highland px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
              >
                <CalendarClock className="h-4 w-4" aria-hidden="true" />
                Manage availability
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-5 rounded-md border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <p className="font-semibold text-slate-900">
            No services to configure
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Create a service first, then configure its existing availability
            rules.
          </p>
          <Link
            href={`/businesses/manage/${businessId}/services`}
            className="mt-4 inline-flex text-sm font-semibold text-highland hover:text-highland/80 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
          >
            Go to services
          </Link>
        </div>
      )}
    </section>
  );
}
