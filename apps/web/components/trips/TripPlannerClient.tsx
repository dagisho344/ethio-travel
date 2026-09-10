'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Archive,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  Plus,
  Trash2,
} from 'lucide-react';
import { TripAiAssistant } from '../ai/TripAiAssistant';
import { Container } from '../../components/ui/Container';
import { getJson } from '../../lib/api';
import { BffRequestError, bffJson } from '../../lib/private-api';
import {
  formatTripDate,
  formatTripDateRange,
  itemTypeOptions,
  statusLabel,
} from '../../lib/trips';
import type {
  BookingListResponse,
  SearchResult,
  SearchResultType,
  Trip,
  TripDay,
  TripItem,
  TripItemType,
} from '../../lib/types';

type ItemCreateInput = {
  type: TripItemType;
  destinationId?: string;
  attractionId?: string;
  businessId?: string;
  serviceId?: string;
  bookingId?: string;
  title?: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
};

const catalogTypes: Partial<Record<TripItemType, SearchResultType>> = {
  DESTINATION: 'destination',
  ATTRACTION: 'attraction',
  BUSINESS: 'business',
  SERVICE: 'service',
};

export function TripPlannerClient({ tripId }: { tripId: string }) {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadTrip = async () => {
    setLoading(true);
    setError(null);
    try {
      setTrip(await bffJson<Trip>(`/api/trips/${tripId}`));
    } catch (requestError) {
      setTrip(null);
      setError(messageFor(requestError, 'We could not load this trip.'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTrip();
  }, [tripId]);

  async function archiveTrip() {
    if (
      !trip ||
      !window.confirm(
        'Archive this trip? Its itinerary will remain available but read-only.',
      )
    )
      return;
    setBusy(true);
    setActionError(null);
    try {
      setTrip(
        await bffJson<Trip>(`/api/trips/${trip.id}/archive`, {
          method: 'POST',
        }),
      );
    } catch (requestError) {
      setActionError(
        messageFor(requestError, 'We could not archive this trip.'),
      );
    } finally {
      setBusy(false);
    }
  }

  async function updateDay(day: TripDay, notes: string) {
    if (!trip) return;
    setBusy(true);
    setActionError(null);
    try {
      await bffJson<TripDay>(`/api/trips/${trip.id}/days/${day.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ notes: notes.trim() || null }),
      });
      await loadTrip();
    } catch (requestError) {
      setActionError(messageFor(requestError, 'We could not update this day.'));
    } finally {
      setBusy(false);
    }
  }

  async function addItem(day: TripDay, input: ItemCreateInput) {
    if (!trip) return;
    setBusy(true);
    setActionError(null);
    try {
      await bffJson<TripItem>(`/api/trips/${trip.id}/days/${day.id}/items`, {
        method: 'POST',
        body: JSON.stringify(input),
      });
      await loadTrip();
    } catch (requestError) {
      setActionError(
        messageFor(requestError, 'We could not add that itinerary item.'),
      );
    } finally {
      setBusy(false);
    }
  }

  async function editItem(day: TripDay, item: TripItem) {
    if (!trip) return;
    const notes = window.prompt('Itinerary notes', item.notes ?? '');
    if (notes === null) return;
    setBusy(true);
    setActionError(null);
    try {
      await bffJson<TripItem>(
        `/api/trips/${trip.id}/days/${day.id}/items/${item.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ notes: notes.trim() || null }),
        },
      );
      await loadTrip();
    } catch (requestError) {
      setActionError(
        messageFor(requestError, 'We could not update that item.'),
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(day: TripDay, item: TripItem) {
    if (
      !trip ||
      !window.confirm(
        `Remove “${item.title ?? 'this item'}” from this itinerary?`,
      )
    )
      return;
    setBusy(true);
    setActionError(null);
    try {
      await bffJson<void>(
        `/api/trips/${trip.id}/days/${day.id}/items/${item.id}`,
        { method: 'DELETE' },
      );
      await loadTrip();
    } catch (requestError) {
      setActionError(
        messageFor(requestError, 'We could not remove that itinerary item.'),
      );
    } finally {
      setBusy(false);
    }
  }

  async function moveItem(day: TripDay, item: TripItem, direction: -1 | 1) {
    if (!trip) return;
    const currentIndex = day.items.findIndex(
      (candidate) => candidate.id === item.id,
    );
    const targetIndex = currentIndex + direction;
    if (targetIndex < 0 || targetIndex >= day.items.length) return;
    const ids = day.items.map((candidate) => candidate.id);
    const currentId = ids[currentIndex];
    const targetId = ids[targetIndex];
    if (!currentId || !targetId) return;
    ids[currentIndex] = targetId;
    ids[targetIndex] = currentId;
    setBusy(true);
    setActionError(null);
    try {
      await bffJson<TripDay>(
        `/api/trips/${trip.id}/days/${day.id}/items/reorder`,
        {
          method: 'POST',
          body: JSON.stringify({ itemIds: ids }),
        },
      );
      await loadTrip();
    } catch (requestError) {
      setActionError(
        messageFor(requestError, 'We could not reorder this day.'),
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="bg-slate-50">
        <Container className="py-12 text-sm text-slate-500">
          Loading your planner...
        </Container>
      </main>
    );
  }
  if (!trip) {
    return (
      <main className="bg-slate-50">
        <Container className="py-12">
          <p
            role="alert"
            className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
          >
            {error ?? 'Trip not found.'}
          </p>
          <Link
            href="/trips"
            className="mt-5 inline-flex text-sm font-semibold text-highland"
          >
            Back to my trips
          </Link>
        </Container>
      </main>
    );
  }

  const readOnly = trip.status === 'ARCHIVED';
  return (
    <main className="bg-slate-50">
      <Container className="py-8 sm:py-10">
        <Link
          href="/trips"
          className="text-sm font-semibold text-highland hover:text-highland/80 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
        >
          ← My trips
        </Link>
        <header className="mt-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-highland">
                {statusLabel(trip.status)}
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">
                {trip.title}
              </h1>
              <p className="mt-2 text-sm font-medium text-slate-700">
                {formatTripDateRange(trip.startDate, trip.endDate)}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {trip.originCity?.name ?? 'Origin to be decided'} →{' '}
                {trip.primaryDestination?.name ??
                  trip.destinationCity?.name ??
                  'Destination to be decided'}
              </p>
            </div>
            {!readOnly ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void archiveTrip()}
                className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:border-amber-500 hover:text-amber-800 disabled:opacity-60"
              >
                <Archive className="h-4 w-4" aria-hidden="true" />
                Archive trip
              </button>
            ) : null}
          </div>
          {trip.notes ? (
            <p className="mt-5 whitespace-pre-wrap border-t border-slate-100 pt-4 text-sm leading-6 text-slate-600">
              {trip.notes}
            </p>
          ) : null}
          {trip.estimatedBookingCost ? (
            <p className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
              {trip.estimatedBookingCost.amount === null
                ? 'Booking total is not combined because currencies are mixed or unknown.'
                : `Known booking total: ${trip.estimatedBookingCost.amount} ${trip.estimatedBookingCost.currency ?? ''}`}
            </p>
          ) : null}
        </header>
        {actionError ? (
          <p
            role="alert"
            className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900"
          >
            {actionError}
          </p>
        ) : null}
        {readOnly ? (
          <p className="mt-5 rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600">
            This trip is archived. Its itinerary and booking context are
            retained, but changes are disabled.
          </p>
        ) : null}
        <TripAiAssistant
          tripId={trip.id}
          disabled={readOnly}
          onApplied={loadTrip}
        />
        <section className="mt-6 space-y-5" aria-label="Itinerary days">
          {trip.days.map((day) => (
            <DayPlanner
              key={day.id}
              day={day}
              readOnly={readOnly}
              busy={busy}
              onUpdateDay={updateDay}
              onAddItem={addItem}
              onEditItem={editItem}
              onRemoveItem={removeItem}
              onMoveItem={moveItem}
            />
          ))}
        </section>
      </Container>
    </main>
  );
}

function DayPlanner({
  day,
  readOnly,
  busy,
  onUpdateDay,
  onAddItem,
  onEditItem,
  onRemoveItem,
  onMoveItem,
}: {
  day: TripDay;
  readOnly: boolean;
  busy: boolean;
  onUpdateDay: (day: TripDay, notes: string) => Promise<void>;
  onAddItem: (day: TripDay, input: ItemCreateInput) => Promise<void>;
  onEditItem: (day: TripDay, item: TripItem) => Promise<void>;
  onRemoveItem: (day: TripDay, item: TripItem) => Promise<void>;
  onMoveItem: (
    day: TripDay,
    item: TripItem,
    direction: -1 | 1,
  ) => Promise<void>;
}) {
  const [notes, setNotes] = useState(day.notes ?? '');
  const [adding, setAdding] = useState(false);
  useEffect(() => setNotes(day.notes ?? ''), [day.notes]);
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-highland">
            Day {day.dayNumber}
          </p>
          <h2 className="mt-1 text-lg font-bold text-slate-950">
            {formatTripDate(day.date)}
          </h2>
        </div>
        {!readOnly ? (
          <button
            type="button"
            onClick={() => setAdding((value) => !value)}
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add item
          </button>
        ) : null}
      </div>
      {!readOnly ? (
        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void onUpdateDay(day, notes);
          }}
        >
          <label className="sr-only" htmlFor={`day-notes-${day.id}`}>
            Day notes
          </label>
          <input
            id={`day-notes-${day.id}`}
            value={notes}
            maxLength={1000}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Add a note for this day"
            className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-highland focus:ring-2 focus:ring-highland/20"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
          >
            Save note
          </button>
        </form>
      ) : day.notes ? (
        <p className="mt-4 whitespace-pre-wrap text-sm text-slate-600">
          {day.notes}
        </p>
      ) : null}
      {adding ? (
        <AddItemForm
          day={day}
          busy={busy}
          onCancel={() => setAdding(false)}
          onAdd={async (input) => {
            await onAddItem(day, input);
            setAdding(false);
          }}
        />
      ) : null}
      <ol className="mt-5 space-y-3">
        {day.items.length ? (
          day.items.map((item, index) => (
            <li
              key={item.id}
              className="flex gap-3 rounded-md border border-slate-200 p-3"
            >
              <div className="pt-0.5 text-sm font-bold text-slate-400">
                {index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {item.type.replace('_', ' ')}
                    </p>
                    <h3 className="text-sm font-semibold text-slate-950">
                      {item.title ?? 'Itinerary item'}
                    </h3>
                  </div>
                  {item.startTime ? (
                    <time className="text-sm font-medium text-slate-600">
                      {item.startTime}
                      {item.endTime ? ` – ${item.endTime}` : ''}
                    </time>
                  ) : null}
                </div>
                {item.notes ? (
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                    {item.notes}
                  </p>
                ) : null}
                {item.booking ? (
                  <div className="mt-2 rounded bg-slate-50 p-2 text-xs text-slate-600">
                    <Link
                      href={`/bookings/${item.booking.id}`}
                      className="font-semibold text-highland hover:underline"
                    >
                      Booking {item.booking.reference}
                    </Link>{' '}
                    · {item.booking.service.name} ·{' '}
                    {item.booking.bookingStatus.replaceAll('_', ' ')} ·{' '}
                    {item.booking.paymentStatus.replaceAll('_', ' ')}
                  </div>
                ) : null}
              </div>
              {!readOnly ? (
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    aria-label={`Move ${item.title ?? 'item'} up`}
                    disabled={busy || index === 0}
                    onClick={() => void onMoveItem(day, item, -1)}
                    className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                  >
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={`Move ${item.title ?? 'item'} down`}
                    disabled={busy || index === day.items.length - 1}
                    onClick={() => void onMoveItem(day, item, 1)}
                    className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                  >
                    <ChevronDown className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void onEditItem(day, item)}
                    disabled={busy}
                    className="rounded px-1 py-1 text-xs font-semibold text-highland hover:bg-emerald-50 disabled:opacity-40"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    aria-label={`Remove ${item.title ?? 'item'}`}
                    onClick={() => void onRemoveItem(day, item)}
                    disabled={busy}
                    className="rounded p-1 text-rose-700 hover:bg-rose-50 disabled:opacity-40"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ) : null}
            </li>
          ))
        ) : (
          <li className="rounded-md border border-dashed border-slate-300 px-4 py-6 text-center text-sm text-slate-500">
            Nothing planned for this day yet.
          </li>
        )}
      </ol>
    </article>
  );
}

function AddItemForm({
  day,
  busy,
  onCancel,
  onAdd,
}: {
  day: TripDay;
  busy: boolean;
  onCancel: () => void;
  onAdd: (input: ItemCreateInput) => Promise<void>;
}) {
  const [type, setType] = useState<TripItemType>('ATTRACTION');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [bookings, setBookings] = useState<BookingListResponse['data']>([]);
  const [targetId, setTargetId] = useState('');
  const [title, setTitle] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [notes, setNotes] = useState('');
  const [searching, setSearching] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const catalogType = catalogTypes[type];

  useEffect(() => {
    let current = true;
    if (type !== 'BOOKING') {
      setBookings([]);
      return () => {
        current = false;
      };
    }
    const load = async () => {
      try {
        const page = await bffJson<BookingListResponse>(
          '/api/bookings?limit=100',
        );
        if (current) setBookings(page.data);
      } catch {
        if (current) setFormError('Your bookings could not be loaded.');
      }
    };
    void load();
    return () => {
      current = false;
    };
  }, [type]);

  const choices = useMemo(
    () =>
      type === 'BOOKING'
        ? bookings.map((booking) => ({
            id: booking.id,
            name: `${booking.reference} · ${booking.service.name}`,
          }))
        : results.map((result) => ({ id: result.id, name: result.name })),
    [bookings, results, type],
  );

  async function searchCatalog() {
    if (!catalogType || !query.trim()) return;
    setSearching(true);
    setFormError(null);
    try {
      const page = await getJson<{ data: SearchResult[] }>('/search', {
        q: query.trim(),
        types: catalogType,
        limit: 20,
      });
      setResults(page.data);
    } catch {
      setResults([]);
      setFormError('No matching public places could be loaded.');
    } finally {
      setSearching(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (startTime && endTime && startTime >= endTime) {
      setFormError('End time must be later than start time.');
      return;
    }
    const input: ItemCreateInput = {
      type,
      startTime: startTime || undefined,
      endTime: endTime || undefined,
      notes: notes.trim() || undefined,
    };
    if (type === 'CUSTOM') {
      if (!title.trim()) {
        setFormError('A custom item needs a title.');
        return;
      }
      input.title = title.trim();
    } else {
      if (!targetId) {
        setFormError(
          type === 'BOOKING'
            ? 'Choose one of your bookings.'
            : 'Search and choose a real public item.',
        );
        return;
      }
      if (type === 'DESTINATION') input.destinationId = targetId;
      if (type === 'ATTRACTION') input.attractionId = targetId;
      if (type === 'BUSINESS') input.businessId = targetId;
      if (type === 'SERVICE') input.serviceId = targetId;
      if (type === 'BOOKING') input.bookingId = targetId;
    }
    await onAdd(input);
  }

  return (
    <form
      onSubmit={(event) => void submit(event)}
      className="mt-5 rounded-md border border-emerald-200 bg-emerald-50 p-4"
    >
      <h3 className="text-sm font-bold text-slate-900">
        Add to Day {day.dayNumber}
      </h3>
      {formError ? (
        <p role="alert" className="mt-3 text-sm text-rose-800">
          {formError}
        </p>
      ) : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">
          Item type
          <select
            value={type}
            onChange={(event) => {
              setType(event.target.value as TripItemType);
              setTargetId('');
              setResults([]);
              setQuery('');
            }}
            className="mt-1 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {itemTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        {type === 'CUSTOM' ? (
          <label className="text-sm font-semibold text-slate-700">
            Title
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={180}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        ) : (
          <label className="text-sm font-semibold text-slate-700">
            {type === 'BOOKING' ? 'Your booking' : 'Search public places'}
            <div className="mt-1 flex gap-2">
              {type !== 'BOOKING' ? (
                <>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    maxLength={200}
                    placeholder="Search"
                    className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void searchCatalog()}
                    disabled={searching || !query.trim()}
                    className="rounded-md border border-slate-300 px-3 text-sm font-semibold disabled:opacity-50"
                  >
                    {searching ? '…' : 'Find'}
                  </button>
                </>
              ) : null}
            </div>
            <select
              value={targetId}
              onChange={(event) => setTargetId(event.target.value)}
              className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Choose an item</option>
              {choices.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="text-sm font-semibold text-slate-700">
          Start time{' '}
          <span className="font-normal text-slate-500">(optional)</span>
          <input
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          End time{' '}
          <span className="font-normal text-slate-500">(optional)</span>
          <input
            type="time"
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="sm:col-span-2 text-sm font-semibold text-slate-700">
          Notes <span className="font-normal text-slate-500">(optional)</span>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            maxLength={1000}
            rows={2}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
      </div>
      <div className="mt-4 flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-md bg-highland px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? (
            <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : null}
          Add item
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function messageFor(error: unknown, fallback: string): string {
  if (error instanceof BffRequestError && error.status === 401)
    return 'Your session has ended. Please sign in again.';
  if (error instanceof BffRequestError && error.status === 403)
    return 'You are not allowed to change this trip.';
  if (error instanceof BffRequestError && error.status === 404)
    return 'That trip or itinerary item is no longer available.';
  return fallback;
}
