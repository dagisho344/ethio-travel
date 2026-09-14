'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  canEditBusiness,
  getManagedBusiness,
} from '../../lib/business-management';
import { operationError } from '../../lib/business-operations';

type Config = {
  enabled: boolean;
  bookingMode: string;
  timezone: string;
  capacity: number;
  minQuantity: number;
  maxQuantity: number;
  minDurationMinutes: number | null;
  maxDurationMinutes: number | null;
  advanceNoticeMinutes: number;
};
const defaultConfig: Config = {
  enabled: false,
  bookingMode: 'TIME_SLOT',
  timezone: 'Africa/Addis_Ababa',
  capacity: 1,
  minQuantity: 1,
  maxQuantity: 1,
  minDurationMinutes: null,
  maxDurationMinutes: null,
  advanceNoticeMinutes: 0,
};

type Rule = {
  id: string;
  weekday: number;
  startTime: string;
  endTime: string;
  capacity: number;
  isActive: boolean;
};
type Override = {
  id: string;
  startAt: string;
  endAt: string;
  type: 'BLOCKED' | 'CAPACITY';
  capacity: number | null;
  reason: string | null;
};
const weekdays = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) },
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      typeof body === 'object' &&
        body !== null &&
        'message' in body &&
        typeof body.message === 'string'
        ? body.message
        : 'Request failed.',
    );
  return body as T;
}

export function BusinessAvailabilityClient({
  businessId,
  serviceId,
}: {
  businessId: string;
  serviceId: string;
}) {
  const [config, setConfig] = useState<Config | null>(null);
  const [rules, setRules] = useState<Rule[]>([]);
  const [overrides, setOverrides] = useState<Override[]>([]);
  const [canWrite, setCanWrite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rule, setRule] = useState({
    weekday: '1',
    startTime: '09:00',
    endTime: '17:00',
    capacity: '1',
  });
  const [override, setOverride] = useState({
    startAt: '',
    endAt: '',
    type: 'BLOCKED' as Override['type'],
    capacity: '1',
    reason: '',
  });

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [loadedConfig, loadedRules, loadedOverrides, business] =
        await Promise.all([
          api<Config | null>(
            `/api/businesses/manage/${businessId}/services/${serviceId}/availability/config`,
          ),
          api<Rule[]>(
            `/api/businesses/manage/${businessId}/services/${serviceId}/availability/rules`,
          ),
          api<Override[]>(
            `/api/businesses/manage/${businessId}/services/${serviceId}/availability/overrides`,
          ),
          getManagedBusiness(businessId),
        ]);
      setConfig(loadedConfig ?? defaultConfig);
      setRules(loadedRules);
      setOverrides(loadedOverrides);
      setCanWrite(canEditBusiness(business));
    } catch (reason) {
      setError(
        operationError(reason, 'Availability settings could not be loaded.'),
      );
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    void load();
  }, [businessId, serviceId]);
  async function saveConfig(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!config || !canWrite || saving) return;
    if (
      config.capacity < 1 ||
      config.minQuantity < 1 ||
      config.maxQuantity < config.minQuantity ||
      config.advanceNoticeMinutes < 0
    ) {
      setError('Capacity, quantity, and lead-time values must be valid.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api(
        `/api/businesses/manage/${businessId}/services/${serviceId}/availability/config`,
        { method: 'PUT', body: JSON.stringify(config) },
      );
      await load();
    } catch (reason) {
      setError(
        operationError(
          reason,
          'Availability configuration could not be saved.',
        ),
      );
    } finally {
      setSaving(false);
    }
  }
  async function addRule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite || saving) return;
    const capacity = Number(rule.capacity);
    const weekday = Number(rule.weekday);
    if (
      !Number.isInteger(capacity) ||
      capacity < 1 ||
      rule.startTime >= rule.endTime
    ) {
      setError(
        'Each weekly interval needs a valid day, capacity, and opening time before closing time.',
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api(
        `/api/businesses/manage/${businessId}/services/${serviceId}/availability/rules`,
        {
          method: 'POST',
          body: JSON.stringify({
            weekday,
            startTime: rule.startTime,
            endTime: rule.endTime,
            capacity,
          }),
        },
      );
      await load();
    } catch (reason) {
      setError(
        operationError(reason, 'Weekly availability could not be added.'),
      );
    } finally {
      setSaving(false);
    }
  }
  async function addOverride(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite || saving) return;
    const startAt = new Date(override.startAt);
    const endAt = new Date(override.endAt);
    const capacity = Number(override.capacity);
    if (
      Number.isNaN(startAt.getTime()) ||
      Number.isNaN(endAt.getTime()) ||
      endAt <= startAt ||
      (override.type === 'CAPACITY' &&
        (!Number.isInteger(capacity) || capacity < 0))
    ) {
      setError('Enter a valid override date range and capacity.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await api(
        `/api/businesses/manage/${businessId}/services/${serviceId}/availability/overrides`,
        {
          method: 'POST',
          body: JSON.stringify({
            startAt: startAt.toISOString(),
            endAt: endAt.toISOString(),
            type: override.type,
            capacity: override.type === 'CAPACITY' ? capacity : null,
            reason: override.reason.trim() || null,
          }),
        },
      );
      setOverride({
        startAt: '',
        endAt: '',
        type: 'BLOCKED',
        capacity: '1',
        reason: '',
      });
      await load();
    } catch (reason) {
      setError(
        operationError(
          reason,
          'Date-specific availability could not be saved.',
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="bg-slate-50">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Link
          href={`/businesses/manage/${businessId}/services`}
          className="text-sm font-semibold text-highland"
        >
          Back to services
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-slate-950">
          Service availability
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          Availability remains server-authoritative; booking capacity and
          overlap protections are unchanged.
        </p>
        {error ? (
          <p
            role="alert"
            className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            {error}
          </p>
        ) : null}
        {loading ? (
          <p className="mt-6 rounded-md bg-white p-5 text-sm text-slate-500">
            Loading availability...
          </p>
        ) : (
          <>
            <form
              onSubmit={(event) => void saveConfig(event)}
              className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
            >
              <h2 className="text-lg font-bold text-slate-950">
                Booking configuration
              </h2>
              {config ? (
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                    <input
                      type="checkbox"
                      checked={config.enabled}
                      disabled={!canWrite}
                      onChange={(event) =>
                        setConfig({ ...config, enabled: event.target.checked })
                      }
                    />{' '}
                    Booking enabled
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Booking mode
                    <select
                      disabled={!canWrite}
                      value={config.bookingMode}
                      onChange={(event) =>
                        setConfig({
                          ...config,
                          bookingMode: event.target.value,
                        })
                      }
                      className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5"
                    >
                      {['TIME_SLOT', 'DATE', 'DATE_RANGE'].map((mode) => (
                        <option key={mode} value={mode}>
                          {mode.replace('_', ' ')}
                        </option>
                      ))}
                    </select>
                  </label>
                  {(
                    [
                      'capacity',
                      'minQuantity',
                      'maxQuantity',
                      'advanceNoticeMinutes',
                    ] as const
                  ).map((key) => (
                    <label
                      key={key}
                      className="text-sm font-semibold text-slate-700"
                    >
                      {key.replace(/([A-Z])/g, ' $1')}
                      <input
                        disabled={!canWrite}
                        inputMode="numeric"
                        value={config[key]}
                        onChange={(event) =>
                          setConfig({
                            ...config,
                            [key]: Number(event.target.value),
                          })
                        }
                        className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5"
                      />
                    </label>
                  ))}
                  <label className="text-sm font-semibold text-slate-700">
                    Timezone
                    <input
                      disabled={!canWrite}
                      value={config.timezone}
                      onChange={(event) =>
                        setConfig({ ...config, timezone: event.target.value })
                      }
                      className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5"
                    />
                  </label>
                </div>
              ) : (
                <p className="mt-3 text-sm text-slate-600">
                  No booking configuration exists yet. Saving creates one.
                </p>
              )}
              {canWrite ? (
                <button
                  disabled={saving}
                  className="mt-5 rounded-md bg-highland px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                >
                  Save availability
                </button>
              ) : (
                <p className="mt-4 text-sm text-slate-600">
                  Staff can view availability but cannot change it.
                </p>
              )}
            </form>
            <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">
                Weekly availability
              </h2>
              <ul className="mt-4 space-y-2 text-sm text-slate-700">
                {rules.length ? (
                  rules.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-wrap justify-between gap-2 rounded-md bg-slate-50 p-3"
                    >
                      <span>
                        {weekdays[item.weekday]} {item.startTime}–{item.endTime}
                      </span>
                      <span>Capacity {item.capacity}</span>
                    </li>
                  ))
                ) : (
                  <li className="text-slate-600">
                    No weekly intervals yet; bookings use configured capacity
                    unless rules are added.
                  </li>
                )}
              </ul>
              {canWrite ? (
                <form
                  onSubmit={(event) => void addRule(event)}
                  className="mt-5 grid gap-3 sm:grid-cols-4"
                >
                  <select
                    value={rule.weekday}
                    onChange={(event) =>
                      setRule({ ...rule, weekday: event.target.value })
                    }
                    className="rounded-md border border-slate-300 p-2.5"
                  >
                    {weekdays.map((day, index) => (
                      <option key={day} value={index}>
                        {day}
                      </option>
                    ))}
                  </select>
                  <input
                    type="time"
                    value={rule.startTime}
                    onChange={(event) =>
                      setRule({ ...rule, startTime: event.target.value })
                    }
                    className="rounded-md border border-slate-300 p-2.5"
                  />
                  <input
                    type="time"
                    value={rule.endTime}
                    onChange={(event) =>
                      setRule({ ...rule, endTime: event.target.value })
                    }
                    className="rounded-md border border-slate-300 p-2.5"
                  />
                  <input
                    inputMode="numeric"
                    value={rule.capacity}
                    onChange={(event) =>
                      setRule({ ...rule, capacity: event.target.value })
                    }
                    className="rounded-md border border-slate-300 p-2.5"
                  />
                  <button
                    disabled={saving}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 sm:col-span-4"
                  >
                    Add weekly interval
                  </button>
                </form>
              ) : null}
            </section>
            <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">
                Date-specific overrides
              </h2>
              {canWrite ? (
                <form
                  onSubmit={(event) => void addOverride(event)}
                  className="mt-4 grid gap-3 sm:grid-cols-2"
                >
                  <label className="text-sm font-semibold text-slate-700">
                    Starts
                    <input
                      required
                      type="datetime-local"
                      value={override.startAt}
                      onChange={(event) =>
                        setOverride({
                          ...override,
                          startAt: event.target.value,
                        })
                      }
                      className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5"
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Ends
                    <input
                      required
                      type="datetime-local"
                      value={override.endAt}
                      onChange={(event) =>
                        setOverride({ ...override, endAt: event.target.value })
                      }
                      className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5"
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Override
                    <select
                      value={override.type}
                      onChange={(event) =>
                        setOverride({
                          ...override,
                          type: event.target.value as Override['type'],
                        })
                      }
                      className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5"
                    >
                      <option value="BLOCKED">Closed</option>
                      <option value="CAPACITY">Custom capacity</option>
                    </select>
                  </label>
                  {override.type === 'CAPACITY' ? (
                    <label className="text-sm font-semibold text-slate-700">
                      Capacity
                      <input
                        required
                        min="0"
                        inputMode="numeric"
                        value={override.capacity}
                        onChange={(event) =>
                          setOverride({
                            ...override,
                            capacity: event.target.value,
                          })
                        }
                        className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5"
                      />
                    </label>
                  ) : null}
                  <label className="text-sm font-semibold text-slate-700 sm:col-span-2">
                    Reason <span className="font-normal">(optional)</span>
                    <input
                      maxLength={300}
                      value={override.reason}
                      onChange={(event) =>
                        setOverride({ ...override, reason: event.target.value })
                      }
                      className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5"
                    />
                  </label>
                  <button
                    disabled={saving}
                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 sm:col-span-2"
                  >
                    Add date-specific override
                  </button>
                </form>
              ) : null}
              <ul className="mt-5 space-y-2 text-sm text-slate-700">
                {overrides.length ? (
                  overrides.map((item) => (
                    <li key={item.id} className="rounded-md bg-slate-50 p-3">
                      {item.type} · {new Date(item.startAt).toLocaleString()} to{' '}
                      {new Date(item.endAt).toLocaleString()}
                      {item.reason ? ` · ${item.reason}` : ''}
                    </li>
                  ))
                ) : (
                  <li className="text-slate-600">
                    No date-specific closures or capacity overrides.
                  </li>
                )}
              </ul>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
