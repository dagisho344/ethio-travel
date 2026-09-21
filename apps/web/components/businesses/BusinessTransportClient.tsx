'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { getJson } from '../../lib/api';
import {
  canEditBusiness,
  getManagedBusiness,
} from '../../lib/business-management';
import {
  createManagedTransportRoute,
  createManagedTransportSchedule,
  getManagedTransport,
  operationError,
  transportScheduleAction,
  updateManagedTransport,
  updateManagedTransportRoute,
  updateManagedTransportSchedule,
} from '../../lib/business-operations';
import type {
  ManagedTransport,
  ManagedTransportRoute,
  ManagedTransportSchedule,
  TransportRouteInput,
  TransportScheduleInput,
} from '../../lib/business-operations';
import type { PaginatedResponse } from '../../lib/types';

type City = { id: string; name: string; slug: string };
type DetailFields = { mode: string; operatorName: string };
type RouteFields = { originCityId: string; destinationCityId: string };
type ScheduleFields = {
  departureAt: string;
  arrivalAt: string;
  fare: string;
  currency: string;
  capacity: string;
};

const blankDetail = (): DetailFields => ({ mode: '', operatorName: '' });
const blankRoute = (): RouteFields => ({
  originCityId: '',
  destinationCityId: '',
});
const blankSchedule = (): ScheduleFields => ({
  departureAt: '',
  arrivalAt: '',
  fare: '',
  currency: 'ETB',
  capacity: '1',
});

function toLocalInput(value: string): string {
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function detailFields(transport: ManagedTransport): DetailFields {
  return {
    mode: transport.detail?.mode ?? '',
    operatorName: transport.detail?.operatorName ?? '',
  };
}

function routeFields(route: ManagedTransportRoute): RouteFields {
  return {
    originCityId: route.originCity.id,
    destinationCityId: route.destinationCity.id,
  };
}

function scheduleFields(schedule: ManagedTransportSchedule): ScheduleFields {
  return {
    departureAt: toLocalInput(schedule.departureAt),
    arrivalAt: toLocalInput(schedule.arrivalAt),
    fare: schedule.fare,
    currency: schedule.currency,
    capacity: String(schedule.capacity),
  };
}

function positiveInteger(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function BusinessTransportClient({
  businessId,
  serviceId,
}: {
  businessId: string;
  serviceId: string;
}) {
  const [transport, setTransport] = useState<ManagedTransport | null>(null);
  const [cities, setCities] = useState<City[]>([]);
  const [canWrite, setCanWrite] = useState(false);
  const [detail, setDetail] = useState<DetailFields>(blankDetail);
  const [route, setRoute] = useState<RouteFields>(blankRoute);
  const [schedule, setSchedule] = useState<ScheduleFields>(blankSchedule);
  const [editingRoute, setEditingRoute] =
    useState<ManagedTransportRoute | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<{
    routeId: string;
    schedule: ManagedTransportSchedule;
  } | null>(null);
  const [scheduleRouteId, setScheduleRouteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [data, business, cityPage] = await Promise.all([
        getManagedTransport(businessId, serviceId),
        getManagedBusiness(businessId),
        getJson<PaginatedResponse<City>>('/cities', { limit: 100 }),
      ]);
      setTransport(data);
      setDetail(detailFields(data));
      setCities(cityPage.data);
      setCanWrite(canEditBusiness(business));
    } catch (reason) {
      setError(
        operationError(reason, 'Transport details could not be loaded.'),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [businessId, serviceId]);

  async function saveDetail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite || saving) return;
    const mode = detail.mode.trim();
    const operatorName = detail.operatorName.trim();
    if (mode.length > 40 || operatorName.length > 180) {
      setError(
        'Mode must be at most 40 characters and operator name at most 180.',
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateManagedTransport(businessId, serviceId, {
        ...(mode ? { mode } : {}),
        ...(operatorName ? { operatorName } : {}),
      });
      setTransport(updated);
      setDetail(detailFields(updated));
    } catch (reason) {
      setError(operationError(reason, 'Transport details could not be saved.'));
    } finally {
      setSaving(false);
    }
  }

  function transportRouteInput(): TransportRouteInput | null {
    if (!route.originCityId || !route.destinationCityId) {
      setError('Choose both origin and destination cities.');
      return null;
    }
    if (route.originCityId === route.destinationCityId) {
      setError('Origin and destination cities must be different.');
      return null;
    }
    return route;
  }

  async function saveRoute(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite || saving) return;
    const input = transportRouteInput();
    if (!input) return;
    setSaving(true);
    setError(null);
    try {
      if (editingRoute) {
        await updateManagedTransportRoute(
          businessId,
          serviceId,
          editingRoute.id,
          input,
        );
      } else {
        await createManagedTransportRoute(businessId, serviceId, input);
      }
      setEditingRoute(null);
      setRoute(blankRoute());
      await load();
    } catch (reason) {
      setError(
        operationError(reason, 'The transport route could not be saved.'),
      );
    } finally {
      setSaving(false);
    }
  }

  function transportScheduleInput(): TransportScheduleInput | null {
    const capacity = positiveInteger(schedule.capacity);
    const departure = new Date(schedule.departureAt);
    const arrival = new Date(schedule.arrivalAt);
    if (!schedule.departureAt || !schedule.arrivalAt || arrival <= departure) {
      setError('Arrival must be after departure.');
      return null;
    }
    if (
      !/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(schedule.fare) ||
      !/^[A-Z]{3}$/.test(schedule.currency) ||
      capacity === null
    ) {
      setError(
        'Use a non-negative decimal fare, uppercase currency, and positive whole capacity.',
      );
      return null;
    }
    return {
      departureAt: departure.toISOString(),
      arrivalAt: arrival.toISOString(),
      fare: schedule.fare,
      currency: schedule.currency,
      capacity,
    };
  }

  async function saveSchedule(
    event: React.FormEvent<HTMLFormElement>,
    routeId: string,
  ) {
    event.preventDefault();
    if (!canWrite || saving) return;
    const input = transportScheduleInput();
    if (!input) return;
    setSaving(true);
    setError(null);
    try {
      if (editingSchedule) {
        await updateManagedTransportSchedule(
          businessId,
          serviceId,
          routeId,
          editingSchedule.schedule.id,
          input,
        );
      } else {
        await createManagedTransportSchedule(
          businessId,
          serviceId,
          routeId,
          input,
        );
      }
      setEditingSchedule(null);
      setScheduleRouteId(null);
      setSchedule(blankSchedule());
      await load();
    } catch (reason) {
      setError(
        operationError(reason, 'The transport schedule could not be saved.'),
      );
    } finally {
      setSaving(false);
    }
  }

  async function setScheduleActive(
    routeId: string,
    scheduleId: string,
    isActive: boolean,
  ) {
    if (!canWrite || saving) return;
    setSaving(true);
    setError(null);
    try {
      await transportScheduleAction(
        businessId,
        serviceId,
        routeId,
        scheduleId,
        isActive ? 'activate' : 'deactivate',
      );
      await load();
    } catch (reason) {
      setError(operationError(reason, 'Schedule status could not be changed.'));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="rounded-md bg-white p-5 text-sm text-slate-500">
        Loading transport details...
      </p>
    );
  }

  return (
    <main className="bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-highland">
              Transport
            </p>
            <h1 className="mt-1 text-2xl font-bold text-slate-950">
              {transport?.service.name ?? 'Transport service'}
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Manage route and dated schedule catalog data. Service availability
              and booking remain authoritative.
            </p>
          </div>
          <Link
            href={`/businesses/manage/${businessId}/services`}
            className="text-sm font-semibold text-highland"
          >
            Back to services
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
        {!canWrite && transport ? (
          <p className="mt-5 rounded-md border border-slate-200 bg-white p-4 text-sm text-slate-600">
            Staff can view transport routes and schedules but cannot change
            them.
          </p>
        ) : null}
        {transport ? (
          <>
            <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">
                Transport details
              </h2>
              <form
                onSubmit={(event) => void saveDetail(event)}
                className="mt-4 grid gap-4 sm:grid-cols-2"
              >
                <label className="text-sm font-semibold text-slate-700">
                  Mode <span className="font-normal">(optional)</span>
                  <input
                    disabled={!canWrite || saving}
                    maxLength={40}
                    value={detail.mode}
                    onChange={(event) =>
                      setDetail((current) => ({
                        ...current,
                        mode: event.target.value,
                      }))
                    }
                    className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5 disabled:bg-slate-100"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Operator name <span className="font-normal">(optional)</span>
                  <input
                    disabled={!canWrite || saving}
                    maxLength={180}
                    value={detail.operatorName}
                    onChange={(event) =>
                      setDetail((current) => ({
                        ...current,
                        operatorName: event.target.value,
                      }))
                    }
                    className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5 disabled:bg-slate-100"
                  />
                </label>
                {canWrite ? (
                  <div className="sm:col-span-2">
                    <button
                      disabled={saving}
                      className="rounded-md bg-highland px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {saving ? 'Saving...' : 'Save transport details'}
                    </button>
                  </div>
                ) : null}
              </form>
            </section>

            {canWrite ? (
              <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-slate-950">
                    {editingRoute ? 'Edit route' : 'Add route'}
                  </h2>
                  {editingRoute ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRoute(null);
                        setRoute(blankRoute());
                      }}
                      className="text-sm font-semibold text-slate-600"
                    >
                      Cancel edit
                    </button>
                  ) : null}
                </div>
                {!transport.detail ? (
                  <p className="mt-3 text-sm text-slate-600">
                    Save transport details first to add routes.
                  </p>
                ) : (
                  <form
                    onSubmit={(event) => void saveRoute(event)}
                    className="mt-4 grid gap-4 sm:grid-cols-2"
                  >
                    <label className="text-sm font-semibold text-slate-700">
                      Origin city
                      <select
                        required
                        disabled={saving}
                        value={route.originCityId}
                        onChange={(event) =>
                          setRoute((current) => ({
                            ...current,
                            originCityId: event.target.value,
                          }))
                        }
                        className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5"
                      >
                        <option value="">Choose a city</option>
                        {cities.map((city) => (
                          <option key={city.id} value={city.id}>
                            {city.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      Destination city
                      <select
                        required
                        disabled={saving}
                        value={route.destinationCityId}
                        onChange={(event) =>
                          setRoute((current) => ({
                            ...current,
                            destinationCityId: event.target.value,
                          }))
                        }
                        className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5"
                      >
                        <option value="">Choose a city</option>
                        {cities.map((city) => (
                          <option key={city.id} value={city.id}>
                            {city.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="sm:col-span-2">
                      <button
                        disabled={saving}
                        className="rounded-md bg-highland px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {saving
                          ? 'Saving...'
                          : editingRoute
                            ? 'Save route'
                            : 'Add route'}
                      </button>
                    </div>
                  </form>
                )}
              </section>
            ) : null}

            <section className="mt-6 space-y-4">
              <h2 className="text-lg font-bold text-slate-950">
                Routes and schedules
              </h2>
              {transport.routes.length ? (
                transport.routes.map((item) => (
                  <article
                    key={item.id}
                    className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3 className="font-bold text-slate-950">
                          {item.originCity.name}{' '}
                          <span aria-hidden="true">→</span>{' '}
                          {item.destinationCity.name}
                        </h3>
                        <p className="mt-1 text-sm text-slate-600">
                          Schedules are configured departure metadata; they do
                          not reserve capacity.
                        </p>
                      </div>
                      {canWrite ? (
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => {
                            setEditingRoute(item);
                            setRoute(routeFields(item));
                          }}
                          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                        >
                          Edit route
                        </button>
                      ) : null}
                    </div>
                    {canWrite ? (
                      <form
                        onSubmit={(event) => void saveSchedule(event, item.id)}
                        className="mt-5 grid gap-3 border-t border-slate-100 pt-5 md:grid-cols-3"
                      >
                        <label className="text-sm font-semibold text-slate-700">
                          Departure
                          <input
                            required
                            disabled={saving}
                            type="datetime-local"
                            value={
                              scheduleRouteId === item.id
                                ? schedule.departureAt
                                : ''
                            }
                            onChange={(event) => {
                              setScheduleRouteId(item.id);
                              setSchedule((current) => ({
                                ...current,
                                departureAt: event.target.value,
                              }));
                            }}
                            className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5"
                          />
                        </label>
                        <label className="text-sm font-semibold text-slate-700">
                          Arrival
                          <input
                            required
                            disabled={saving}
                            type="datetime-local"
                            value={
                              scheduleRouteId === item.id
                                ? schedule.arrivalAt
                                : ''
                            }
                            onChange={(event) => {
                              setScheduleRouteId(item.id);
                              setSchedule((current) => ({
                                ...current,
                                arrivalAt: event.target.value,
                              }));
                            }}
                            className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5"
                          />
                        </label>
                        <label className="text-sm font-semibold text-slate-700">
                          Fare
                          <input
                            required
                            disabled={saving}
                            inputMode="decimal"
                            value={
                              scheduleRouteId === item.id ? schedule.fare : ''
                            }
                            onChange={(event) => {
                              setScheduleRouteId(item.id);
                              setSchedule((current) => ({
                                ...current,
                                fare: event.target.value,
                              }));
                            }}
                            className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5"
                          />
                        </label>
                        <label className="text-sm font-semibold text-slate-700">
                          Currency
                          <input
                            required
                            disabled={saving}
                            maxLength={3}
                            value={
                              scheduleRouteId === item.id
                                ? schedule.currency
                                : 'ETB'
                            }
                            onChange={(event) => {
                              setScheduleRouteId(item.id);
                              setSchedule((current) => ({
                                ...current,
                                currency: event.target.value.toUpperCase(),
                              }));
                            }}
                            className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5"
                          />
                        </label>
                        <label className="text-sm font-semibold text-slate-700">
                          Capacity
                          <input
                            required
                            disabled={saving}
                            inputMode="numeric"
                            value={
                              scheduleRouteId === item.id
                                ? schedule.capacity
                                : '1'
                            }
                            onChange={(event) => {
                              setScheduleRouteId(item.id);
                              setSchedule((current) => ({
                                ...current,
                                capacity: event.target.value,
                              }));
                            }}
                            className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5"
                          />
                        </label>
                        <div className="flex items-end gap-3">
                          <button
                            disabled={saving}
                            className="rounded-md bg-highland px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                          >
                            {saving
                              ? 'Saving...'
                              : editingSchedule?.routeId === item.id
                                ? 'Save schedule'
                                : 'Add schedule'}
                          </button>
                          {editingSchedule?.routeId === item.id ? (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingSchedule(null);
                                setScheduleRouteId(null);
                                setSchedule(blankSchedule());
                              }}
                              className="text-sm font-semibold text-slate-600"
                            >
                              Cancel
                            </button>
                          ) : null}
                        </div>
                      </form>
                    ) : null}
                    <div className="mt-5 space-y-3">
                      {item.schedules.length ? (
                        item.schedules.map((scheduleItem) => (
                          <div
                            key={scheduleItem.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-200 p-3 text-sm"
                          >
                            <div>
                              <p className="font-semibold text-slate-800">
                                {new Date(
                                  scheduleItem.departureAt,
                                ).toLocaleString()}{' '}
                                →{' '}
                                {new Date(
                                  scheduleItem.arrivalAt,
                                ).toLocaleString()}
                              </p>
                              <p className="mt-1 text-slate-600">
                                {scheduleItem.fare} {scheduleItem.currency} ·
                                capacity {scheduleItem.capacity} ·{' '}
                                {scheduleItem.isActive ? 'Active' : 'Inactive'}
                              </p>
                            </div>
                            {canWrite ? (
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() => {
                                    setEditingSchedule({
                                      routeId: item.id,
                                      schedule: scheduleItem,
                                    });
                                    setScheduleRouteId(item.id);
                                    setSchedule(scheduleFields(scheduleItem));
                                  }}
                                  className="rounded-md border border-slate-300 px-3 py-2 font-semibold text-slate-700"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  disabled={saving}
                                  onClick={() =>
                                    void setScheduleActive(
                                      item.id,
                                      scheduleItem.id,
                                      !scheduleItem.isActive,
                                    )
                                  }
                                  className="rounded-md border border-slate-300 px-3 py-2 font-semibold text-slate-700"
                                >
                                  {scheduleItem.isActive
                                    ? 'Deactivate'
                                    : 'Reactivate'}
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ))
                      ) : (
                        <p className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-600">
                          No schedules have been added for this route.
                        </p>
                      )}
                    </div>
                  </article>
                ))
              ) : (
                <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
                  No routes have been added yet.
                </p>
              )}
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
