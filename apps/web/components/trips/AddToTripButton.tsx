'use client';

import Link from 'next/link';
import { CalendarPlus, Loader2, X } from 'lucide-react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BffRequestError, bffJson } from '../../lib/private-api';
import type { Trip, TripItemType, TripListResponse } from '../../lib/types';

export type TripCatalogTargetType = Exclude<TripItemType, 'BOOKING' | 'CUSTOM'>;

type AddToTripButtonProps = {
  targetId: string;
  targetName: string;
  targetType: TripCatalogTargetType;
  className?: string;
  label?: string;
};

function safeReturnTo(pathname: string, query: string): string {
  const value = query ? `${pathname}?${query}` : pathname;
  return value.startsWith('/') && !value.startsWith('//') ? value : '/search';
}

function itemPayload(targetType: TripCatalogTargetType, targetId: string) {
  if (targetType === 'DESTINATION') {
    return { type: targetType, destinationId: targetId };
  }
  if (targetType === 'ATTRACTION') {
    return { type: targetType, attractionId: targetId };
  }
  if (targetType === 'BUSINESS') {
    return { type: targetType, businessId: targetId };
  }
  return { type: targetType, serviceId: targetId };
}

function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof BffRequestError && error.status === 403) {
    return 'You are not allowed to add this item to that trip.';
  }
  if (error instanceof BffRequestError && error.status === 404) {
    return 'That trip, day, or public item is no longer available.';
  }
  if (error instanceof BffRequestError && error.status === 409) {
    return 'This trip changed before the item could be added. Refresh and try again.';
  }
  return fallback;
}

/**
 * Adds an existing public catalog item to an owned, non-archived trip. The
 * Trip API remains authoritative for public eligibility and trip ownership.
 */
export function AddToTripButton({
  targetId,
  targetName,
  targetType,
  className,
  label = 'Add to trip',
}: AddToTripButtonProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const tripRequestId = useRef(0);
  const [open, setOpen] = useState(false);
  const [tripPage, setTripPage] = useState(1);
  const [tripReloadNonce, setTripReloadNonce] = useState(0);
  const [trips, setTrips] = useState<TripListResponse | null>(null);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [tripsError, setTripsError] = useState<string | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
  const [selectedDayId, setSelectedDayId] = useState('');
  const [tripLoading, setTripLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [addedTripId, setAddedTripId] = useState<string | null>(null);

  const returnTo = useMemo(
    () => safeReturnTo(pathname, searchParams.toString()),
    [pathname, searchParams],
  );

  const close = () => {
    setOpen(false);
    setSelectedTrip(null);
    setSelectedDayId('');
    setActionError(null);
    setAddedTripId(null);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      setSelectedTrip(null);
      setSelectedDayId('');
      setActionError(null);
      setAddedTripId(null);
      triggerRef.current?.focus();
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let current = true;
    const loadTrips = async () => {
      setTripsLoading(true);
      setTripsError(null);
      try {
        const page = await bffJson<TripListResponse>(
          `/api/trips?page=${tripPage}&limit=20&sort=SOONEST`,
        );
        if (current) setTrips(page);
      } catch (error) {
        if (!current) return;
        if (error instanceof BffRequestError && error.status === 401) {
          router.push(`/login?returnTo=${encodeURIComponent(returnTo)}`);
          setOpen(false);
          return;
        }
        setTrips(null);
        setTripsError(errorMessage(error, 'We could not load your trips.'));
      } finally {
        if (current) setTripsLoading(false);
      }
    };
    void loadTrips();
    return () => {
      current = false;
    };
  }, [open, returnTo, router, tripPage, tripReloadNonce]);

  async function selectTrip(tripId: string) {
    const requestId = tripRequestId.current + 1;
    tripRequestId.current = requestId;
    setSelectedTrip(null);
    setSelectedDayId('');
    setActionError(null);
    setTripLoading(true);
    try {
      const trip = await bffJson<Trip>(`/api/trips/${tripId}`);
      if (requestId !== tripRequestId.current) return;
      if (trip.status === 'ARCHIVED') {
        setActionError('Archived trips are read-only. Choose another trip.');
        return;
      }
      setSelectedTrip(trip);
      setSelectedDayId(trip.days[0]?.id ?? '');
    } catch (error) {
      if (requestId === tripRequestId.current) {
        if (error instanceof BffRequestError && error.status === 401) {
          router.push(`/login?returnTo=${encodeURIComponent(returnTo)}`);
          setOpen(false);
          return;
        }
        setActionError(errorMessage(error, 'We could not load that trip.'));
      }
    } finally {
      if (requestId === tripRequestId.current) setTripLoading(false);
    }
  }

  async function addToTrip() {
    if (!selectedTrip || !selectedDayId || adding || addedTripId) return;
    setAdding(true);
    setActionError(null);
    try {
      await bffJson(
        `/api/trips/${selectedTrip.id}/days/${selectedDayId}/items`,
        {
          method: 'POST',
          body: JSON.stringify(itemPayload(targetType, targetId)),
        },
      );
      setAddedTripId(selectedTrip.id);
    } catch (error) {
      if (error instanceof BffRequestError && error.status === 401) {
        router.push(`/login?returnTo=${encodeURIComponent(returnTo)}`);
        setOpen(false);
        return;
      }
      setActionError(
        errorMessage(error, 'We could not add this item to your trip.'),
      );
    } finally {
      setAdding(false);
    }
  }

  const activeTrips = trips?.data.filter((trip) => trip.status !== 'ARCHIVED');

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setTripPage(1);
          setOpen(true);
        }}
        className={
          className ??
          'inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-highland hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2'
        }
      >
        <CalendarPlus className="h-4 w-4" aria-hidden="true" />
        {label}
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-[1300] flex items-end bg-slate-950/35 p-3 sm:items-center sm:justify-center sm:p-6"
          onMouseDown={(event) => {
            if (event.currentTarget === event.target) close();
          }}
        >
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className="max-h-[min(42rem,calc(100dvh-1.5rem))] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-5 shadow-2xl outline-none sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-highland">
                  Trip Planner
                </p>
                <h2
                  id={titleId}
                  className="mt-1 text-xl font-bold text-slate-950"
                >
                  Add {targetName} to a trip
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Choose one of your active trips and the day where this public
                  item belongs.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close add to trip dialog"
                className="rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-950 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="mt-5 space-y-4">
              {tripsLoading ? (
                <p
                  className="flex items-center gap-2 text-sm text-slate-600"
                  role="status"
                >
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  Loading your trips...
                </p>
              ) : null}
              {tripsError ? (
                <div
                  role="alert"
                  className="rounded-md bg-amber-50 p-3 text-sm text-amber-900"
                >
                  <p>{tripsError}</p>
                  <button
                    type="button"
                    onClick={() => setTripReloadNonce((value) => value + 1)}
                    className="mt-2 font-semibold text-highland underline"
                  >
                    Retry
                  </button>
                </div>
              ) : null}
              {!tripsLoading && !tripsError && activeTrips?.length === 0 ? (
                <div className="rounded-md border border-dashed border-slate-300 p-4 text-sm text-slate-600">
                  <p>You do not have an active trip yet.</p>
                  <Link
                    href="/trips/new"
                    className="mt-2 inline-flex font-semibold text-highland hover:underline"
                    onClick={close}
                  >
                    Plan a trip first
                  </Link>
                </div>
              ) : null}
              {activeTrips?.length ? (
                <label className="block text-sm font-semibold text-slate-700">
                  Active trip
                  <select
                    value={selectedTrip?.id ?? ''}
                    onChange={(event) => void selectTrip(event.target.value)}
                    disabled={tripLoading || adding}
                    className="mt-1.5 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-highland focus:ring-2 focus:ring-highland/20 disabled:cursor-not-allowed disabled:bg-slate-100"
                  >
                    <option value="">Choose a trip</option>
                    {activeTrips.map((trip) => (
                      <option key={trip.id} value={trip.id}>
                        {trip.title} ({trip.startDate} to {trip.endDate})
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {tripLoading ? (
                <p
                  className="flex items-center gap-2 text-sm text-slate-600"
                  role="status"
                >
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  Loading trip days...
                </p>
              ) : null}
              {selectedTrip ? (
                <label className="block text-sm font-semibold text-slate-700">
                  Trip day
                  <select
                    value={selectedDayId}
                    onChange={(event) => setSelectedDayId(event.target.value)}
                    disabled={adding}
                    className="mt-1.5 block w-full rounded-md border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-highland focus:ring-2 focus:ring-highland/20 disabled:cursor-not-allowed disabled:bg-slate-100"
                  >
                    {selectedTrip.days.map((day) => (
                      <option key={day.id} value={day.id}>
                        Day {day.dayNumber} - {day.date}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
              {trips && trips.meta.totalPages > 1 ? (
                <div className="flex items-center justify-between gap-3 text-sm text-slate-600">
                  <button
                    type="button"
                    disabled={tripPage <= 1 || tripsLoading}
                    onClick={() => {
                      setSelectedTrip(null);
                      setSelectedDayId('');
                      setTripPage((page) => page - 1);
                    }}
                    className="rounded-md border border-slate-300 px-3 py-2 font-semibold disabled:opacity-40"
                  >
                    Previous trips
                  </button>
                  <span>
                    Page {trips.meta.page} of {trips.meta.totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={tripPage >= trips.meta.totalPages || tripsLoading}
                    onClick={() => {
                      setSelectedTrip(null);
                      setSelectedDayId('');
                      setTripPage((page) => page + 1);
                    }}
                    className="rounded-md border border-slate-300 px-3 py-2 font-semibold disabled:opacity-40"
                  >
                    More trips
                  </button>
                </div>
              ) : null}
              {actionError ? (
                <p
                  role="alert"
                  className="rounded-md bg-amber-50 p-3 text-sm text-amber-900"
                >
                  {actionError}
                </p>
              ) : null}
              {addedTripId ? (
                <div
                  className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900"
                  role="status"
                >
                  <p className="font-semibold">Added to your trip.</p>
                  <Link
                    href={`/trips/${addedTripId}`}
                    onClick={close}
                    className="mt-2 inline-flex font-semibold text-highland hover:underline"
                  >
                    Open trip planner
                  </Link>
                </div>
              ) : null}
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={close}
                disabled={adding}
                className="rounded-md border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-slate-400 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void addToTrip()}
                disabled={
                  !selectedTrip ||
                  !selectedDayId ||
                  adding ||
                  Boolean(addedTripId)
                }
                className="inline-flex items-center justify-center gap-2 rounded-md bg-highland px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {adding ? (
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : null}
                Add to selected day
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
