'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getJson } from '../../lib/api';
import {
  canEditBusiness,
  getManagedBusiness,
  requestErrorMessage,
} from '../../lib/business-management';
import {
  archiveLocation,
  createLocation,
  getLocations,
  makeLocationPrimary,
  saveLocationHours,
  updateLocation,
} from '../../lib/business-locations';
import type {
  BusinessWeekday,
  LocationInput,
  ManagedLocation,
  OperatingHour,
} from '../../lib/business-locations';
import type { PaginatedResponse } from '../../lib/types';

const days: Array<[BusinessWeekday, string]> = [
  ['MONDAY', 'Monday'],
  ['TUESDAY', 'Tuesday'],
  ['WEDNESDAY', 'Wednesday'],
  ['THURSDAY', 'Thursday'],
  ['FRIDAY', 'Friday'],
  ['SATURDAY', 'Saturday'],
  ['SUNDAY', 'Sunday'],
];
type Region = { id: string; name: string; slug: string };
type City = { id: string; name: string; slug: string; regionId: string };
type Destination = { id: string; name: string; slug: string };
type Fields = {
  label: string;
  regionId: string;
  cityId: string;
  destinationId: string;
  addressLine1: string;
  addressLine2: string;
  neighborhood: string;
  postalCode: string;
  latitude: string;
  longitude: string;
  timezone: string;
  status: 'ACTIVE' | 'INACTIVE';
};
const blank: Fields = {
  label: '',
  regionId: '',
  cityId: '',
  destinationId: '',
  addressLine1: '',
  addressLine2: '',
  neighborhood: '',
  postalCode: '',
  latitude: '',
  longitude: '',
  timezone: 'Africa/Addis_Ababa',
  status: 'ACTIVE',
};
const errorText = (e: unknown) => requestErrorMessage(e, 'Please try again.');
const input =
  'mt-1 block w-full rounded border border-slate-300 px-3 py-2 text-slate-900 focus:border-highland focus:ring-2 focus:ring-highland/20';
function schedule(hours: OperatingHour[] = []): OperatingHour[] {
  return days.map(
    ([dayOfWeek]) =>
      hours.find((hour) => hour.dayOfWeek === dayOfWeek) ?? {
        dayOfWeek,
        isClosed: true,
        opensAt: null,
        closesAt: null,
      },
  );
}

export function BusinessLocationsClient({
  businessId,
}: {
  businessId: string;
}) {
  const [locations, setLocations] = useState<ManagedLocation[]>([]);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ManagedLocation | null | undefined>();
  const [hoursFor, setHoursFor] = useState<ManagedLocation | null>(null);
  const reload = async () => {
    try {
      const [business, data] = await Promise.all([
        getManagedBusiness(businessId),
        getLocations(businessId),
      ]);
      setCanEdit(canEditBusiness(business));
      setLocations(data);
      setError(null);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void reload();
  }, [businessId]);
  const action = async (run: () => Promise<unknown>) => {
    try {
      await run();
      await reload();
    } catch (e) {
      setError(errorText(e));
    }
  };
  if (loading)
    return <main className="mx-auto max-w-6xl p-6">Loading locations…</main>;
  return (
    <main className="mx-auto max-w-6xl p-4 sm:p-6">
      <Link
        className="text-sm font-semibold text-highland"
        href={`/businesses/manage/${businessId}`}
      >
        ← Business workspace
      </Link>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Locations</h1>
          <p className="text-slate-600">
            Manage branches and their local operating hours.
          </p>
        </div>
        {canEdit ? (
          <button
            className="rounded bg-highland px-4 py-2 font-semibold text-white"
            onClick={() => setEditing(null)}
          >
            Add Location
          </button>
        ) : (
          <p className="text-sm text-slate-600">
            Staff members have read-only access.
          </p>
        )}
      </div>
      {error ? (
        <p className="mt-4 rounded bg-red-50 p-3 text-red-800" role="alert">
          {error}
        </p>
      ) : null}
      {editing !== undefined ? (
        <LocationForm
          businessId={businessId}
          location={editing}
          onDone={() => {
            setEditing(undefined);
            void reload();
          }}
          onCancel={() => setEditing(undefined)}
        />
      ) : null}
      {hoursFor ? (
        <HoursEditor
          businessId={businessId}
          location={hoursFor}
          onDone={() => {
            setHoursFor(null);
            void reload();
          }}
        />
      ) : null}
      <div className="mt-6 grid gap-4">
        {locations.map((location) => (
          <article
            key={location.id}
            className="rounded-lg border bg-white p-5 shadow-sm"
          >
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <h2 className="font-bold text-slate-950">
                  {location.label}{' '}
                  {location.isPrimary ? (
                    <span className="ml-2 rounded bg-highland/10 px-2 py-1 text-xs text-highland">
                      PRIMARY
                    </span>
                  ) : null}
                </h2>
                <p className="text-sm text-slate-600">
                  {location.city.name}
                  {location.destination
                    ? ` · ${location.destination.name}`
                    : ''}
                </p>
                <p className="text-sm text-slate-600">
                  {location.addressLine1}
                  {location.neighborhood ? `, ${location.neighborhood}` : ''}
                </p>
                <p className="mt-2 text-xs font-semibold text-slate-500">
                  {location.status} · {hoursSummary(location.operatingHours)}
                </p>
              </div>
              {canEdit ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded border px-3 py-1.5 text-sm"
                    onClick={() => setEditing(location)}
                  >
                    Edit
                  </button>
                  <button
                    className="rounded border px-3 py-1.5 text-sm"
                    onClick={() => setHoursFor(location)}
                  >
                    Manage Hours
                  </button>
                  {!location.isPrimary && location.status === 'ACTIVE' ? (
                    <button
                      className="rounded border px-3 py-1.5 text-sm"
                      onClick={() =>
                        void action(() =>
                          makeLocationPrimary(businessId, location.id),
                        )
                      }
                    >
                      Set Primary
                    </button>
                  ) : null}
                  {!location.isPrimary && location.status !== 'ARCHIVED' ? (
                    <button
                      className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700"
                      onClick={() =>
                        void action(() =>
                          archiveLocation(businessId, location.id),
                        )
                      }
                    >
                      Archive
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </main>
  );
}
function hoursSummary(hours: OperatingHour[]) {
  const open = hours.filter((h) => !h.isClosed).length;
  return open
    ? `${open} open day${open === 1 ? '' : 's'} each week`
    : 'Hours not set';
}
function LocationForm({
  businessId,
  location,
  onDone,
  onCancel,
}: {
  businessId: string;
  location: ManagedLocation | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [fields, setFields] = useState<Fields>(() =>
    location
      ? {
          label: location.label,
          regionId: location.city.region.id,
          cityId: location.city.id,
          destinationId: location.destination?.id ?? '',
          addressLine1: location.addressLine1,
          addressLine2: location.addressLine2 ?? '',
          neighborhood: location.neighborhood ?? '',
          postalCode: location.postalCode ?? '',
          latitude: String(location.latitude),
          longitude: String(location.longitude),
          timezone: location.timezone,
          status: location.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
        }
      : blank,
  );
  const [regions, setRegions] = useState<Region[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const selectedRegion = regions.find((r) => r.id === fields.regionId);
  const selectedCity = cities.find((c) => c.id === fields.cityId);
  const visibleCities = useMemo(
    () => cities.filter((c) => c.regionId === fields.regionId),
    [cities, fields.regionId],
  );
  useEffect(() => {
    void Promise.all([
      getJson<PaginatedResponse<Region>>('/regions', { limit: 100 }),
      getJson<PaginatedResponse<City>>('/cities', { limit: 100 }),
    ])
      .then(([r, c]) => {
        setRegions(r.data);
        setCities(c.data);
      })
      .catch(() => setError('Locations could not be loaded.'));
  }, []);
  useEffect(() => {
    if (!selectedRegion || !selectedCity) {
      setDestinations([]);
      return;
    }
    void getJson<PaginatedResponse<Destination>>(
      `/regions/${selectedRegion.slug}/cities/${selectedCity.slug}/destinations`,
      { limit: 100 },
    )
      .then((p) => setDestinations(p.data))
      .catch(() => setDestinations([]));
  }, [selectedCity, selectedRegion]);
  const change = (key: keyof Fields, value: string) =>
    setFields((current) => ({ ...current, [key]: value }));
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const latitude = Number(fields.latitude),
      longitude = Number(fields.longitude);
    if (
      !fields.label.trim() ||
      !fields.cityId ||
      !fields.addressLine1.trim() ||
      !Number.isFinite(latitude) ||
      !Number.isFinite(longitude)
    ) {
      setError('Complete the required location fields.');
      return;
    }
    setSaving(true);
    try {
      const input: LocationInput = {
        label: fields.label.trim(),
        cityId: fields.cityId,
        destinationId: fields.destinationId || (location ? null : undefined),
        addressLine1: fields.addressLine1.trim(),
        addressLine2: fields.addressLine2 || undefined,
        neighborhood: fields.neighborhood || undefined,
        postalCode: fields.postalCode || undefined,
        latitude,
        longitude,
        timezone: fields.timezone,
        ...(location ? { status: fields.status } : {}),
      };
      if (location) await updateLocation(businessId, location.id, input);
      else await createLocation(businessId, input);
      onDone();
    } catch (e2) {
      setError(errorText(e2));
    } finally {
      setSaving(false);
    }
  };
  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="mt-6 rounded-lg border bg-slate-50 p-5"
    >
      <h2 className="font-bold">
        {location ? 'Edit location' : 'Add location'}
      </h2>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <label>
          Label
          <input
            required
            className={input}
            value={fields.label}
            onChange={(e) => change('label', e.target.value)}
          />
        </label>
        <label>
          Region
          <select
            required
            className={input}
            value={fields.regionId}
            onChange={(e) =>
              setFields((c) => ({
                ...c,
                regionId: e.target.value,
                cityId: '',
                destinationId: '',
              }))
            }
          >
            <option value="">Select region</option>
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          City
          <select
            required
            className={input}
            value={fields.cityId}
            onChange={(e) =>
              setFields((c) => ({
                ...c,
                cityId: e.target.value,
                destinationId: '',
              }))
            }
          >
            <option value="">Select city</option>
            {visibleCities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Destination
          <select
            className={input}
            value={fields.destinationId}
            onChange={(e) => change('destinationId', e.target.value)}
          >
            <option value="">None</option>
            {destinations.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Address
          <input
            required
            className={input}
            value={fields.addressLine1}
            onChange={(e) => change('addressLine1', e.target.value)}
          />
        </label>
        <label>
          Address line 2 (optional)
          <input
            className={input}
            value={fields.addressLine2}
            onChange={(e) => change('addressLine2', e.target.value)}
          />
        </label>
        <label>
          Neighborhood (optional)
          <input
            className={input}
            value={fields.neighborhood}
            onChange={(e) => change('neighborhood', e.target.value)}
          />
        </label>
        <label>
          Postal code (optional)
          <input
            className={input}
            value={fields.postalCode}
            onChange={(e) => change('postalCode', e.target.value)}
          />
        </label>
        <label>
          Timezone
          <input
            required
            className={input}
            value={fields.timezone}
            onChange={(e) => change('timezone', e.target.value)}
          />
        </label>
        {location ? (
          <label>
            Status
            <select
              className={input}
              value={fields.status}
              onChange={(e) => change('status', e.target.value)}
            >
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </label>
        ) : null}
        <label>
          Latitude
          <input
            required
            type="number"
            step="0.000001"
            className={input}
            value={fields.latitude}
            onChange={(e) => change('latitude', e.target.value)}
          />
        </label>
        <label>
          Longitude
          <input
            required
            type="number"
            step="0.000001"
            className={input}
            value={fields.longitude}
            onChange={(e) => change('longitude', e.target.value)}
          />
        </label>
      </div>
      <div className="mt-4 flex gap-3">
        <button
          disabled={saving}
          className="rounded bg-highland px-4 py-2 font-semibold text-white disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save location'}
        </button>
        <button
          type="button"
          className="rounded border px-4 py-2"
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
function HoursEditor({
  businessId,
  location,
  onDone,
}: {
  businessId: string;
  location: ManagedLocation;
  onDone: () => void;
}) {
  const [hours, setHours] = useState(() => schedule(location.operatingHours));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const update = (day: BusinessWeekday, data: Partial<OperatingHour>) =>
    setHours((current) =>
      current.map((h) => (h.dayOfWeek === day ? { ...h, ...data } : h)),
    );
  const save = async () => {
    setSaving(true);
    try {
      await saveLocationHours(businessId, location.id, hours);
      onDone();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="mt-6 rounded-lg border bg-slate-50 p-5">
      <h2 className="font-bold">Weekly hours — {location.label}</h2>
      {error ? <p className="mt-2 text-sm text-red-700">{error}</p> : null}
      <div className="mt-3 space-y-2">
        {days.map(([day, label]) => {
          const h = hours.find((x) => x.dayOfWeek === day)!;
          return (
            <div
              key={day}
              className="grid gap-2 text-sm sm:grid-cols-[6rem_auto_minmax(0,1fr)] sm:items-center"
            >
              <span>{label}</span>
              <label>
                <input
                  type="checkbox"
                  checked={!h.isClosed}
                  onChange={(e) =>
                    update(day, {
                      isClosed: !e.target.checked,
                      opensAt: e.target.checked ? '09:00' : null,
                      closesAt: e.target.checked ? '17:00' : null,
                    })
                  }
                />{' '}
                Open
              </label>
              {!h.isClosed ? (
                <span className="flex flex-wrap gap-2">
                  <input
                    aria-label={`${label} opening time`}
                    type="time"
                    value={h.opensAt ?? ''}
                    onChange={(e) => update(day, { opensAt: e.target.value })}
                  />
                  <input
                    aria-label={`${label} closing time`}
                    type="time"
                    value={h.closesAt ?? ''}
                    onChange={(e) => update(day, { closesAt: e.target.value })}
                  />
                </span>
              ) : (
                <span>Closed</span>
              )}
            </div>
          );
        })}
      </div>
      <button
        disabled={saving}
        onClick={() => void save()}
        className="mt-4 rounded bg-highland px-4 py-2 font-semibold text-white disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save hours'}
      </button>
    </section>
  );
}
