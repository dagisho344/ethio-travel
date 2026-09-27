'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import {
  Archive,
  ChevronDown,
  ChevronUp,
  LoaderCircle,
  Plus,
  Trash2,
} from 'lucide-react';
import { TripAiAssistant } from '../ai/TripAiAssistant';
import { TripBudgetPlanner } from './TripBudgetPlanner';
import { TripSharePanel } from './TripSharePanel';
import { Container } from '../../components/ui/Container';
import { getJson } from '../../lib/api';
import { BffRequestError, bffJson } from '../../lib/private-api';
import { itemTypeOptions } from '../../lib/trips';
import { resolveLocale } from '../../i18n/config';
import { formatLocaleCalendarDate, formatLocaleMoney } from '../../i18n/format';
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

type TripErrorMessages = {
  sessionEnded: string;
  changeDenied: string;
  itemUnavailable: string;
};

const catalogTypes: Partial<Record<TripItemType, SearchResultType>> = {
  DESTINATION: 'destination',
  ATTRACTION: 'attraction',
  BUSINESS: 'business',
  SERVICE: 'service',
};

function tripStatusKey(status: Trip['status']) {
  return (
    {
      DRAFT: 'draft',
      UPCOMING: 'upcoming',
      IN_PROGRESS: 'inProgress',
      COMPLETED: 'completed',
      ARCHIVED: 'archived',
    } as const
  )[status];
}

function itemTypeKey(type: TripItemType) {
  return (
    {
      DESTINATION: 'destination',
      ATTRACTION: 'attraction',
      BUSINESS: 'business',
      SERVICE: 'service',
      BOOKING: 'booking',
      CUSTOM: 'custom',
    } as const
  )[type];
}

export function TripPlannerClient({ tripId }: { tripId: string }) {
  const t = useTranslations('trips');
  const locale = resolveLocale(useLocale());
  const tripErrorMessages: TripErrorMessages = {
    sessionEnded: t('sessionEnded'),
    changeDenied: t('changeDenied'),
    itemUnavailable: t('itemUnavailable'),
  };
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
      setError(messageFor(requestError, t('loadError'), tripErrorMessages));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadTrip();
  }, [tripId]);

  async function archiveTrip() {
    if (!trip || !window.confirm(t('archiveConfirm'))) return;
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
        messageFor(requestError, t('archiveError'), tripErrorMessages),
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
      setActionError(
        messageFor(requestError, t('updateDayError'), tripErrorMessages),
      );
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
        messageFor(requestError, t('addItemError'), tripErrorMessages),
      );
    } finally {
      setBusy(false);
    }
  }

  async function editItem(day: TripDay, item: TripItem) {
    if (!trip) return;
    const notes = window.prompt(t('editPrompt'), item.notes ?? '');
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
        messageFor(requestError, t('updateItemError'), tripErrorMessages),
      );
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(day: TripDay, item: TripItem) {
    if (
      !trip ||
      !window.confirm(
        t('removeConfirm', { name: item.title ?? t('itineraryItem') }),
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
        messageFor(requestError, t('removeItemError'), tripErrorMessages),
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
        messageFor(requestError, t('reorderError'), tripErrorMessages),
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="bg-slate-50">
        <Container className="py-12 text-sm text-slate-500">
          {t('loadingPlanner')}
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
            {error ?? t('notFound')}
          </p>
          <Link
            href="/trips"
            className="mt-5 inline-flex text-sm font-semibold text-highland"
          >
            {t('backToTrips')}
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
          ← {t('title')}
        </Link>
        <header className="mt-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-highland">
                {t(tripStatusKey(trip.status))}
              </p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950 sm:text-3xl">
                {trip.title}
              </h1>
              <p className="mt-2 text-sm font-medium text-slate-700">
                {formatLocaleCalendarDate(trip.startDate, locale)} –{' '}
                {formatLocaleCalendarDate(trip.endDate, locale)}
              </p>
              <p className="mt-1 text-sm text-slate-600">
                {trip.originCity?.name ?? t('originPending')} →{' '}
                {trip.primaryDestination?.name ??
                  trip.destinationCity?.name ??
                  t('destinationPending')}
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
                {t('archive')}
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
                ? t('bookingTotalMixed')
                : t('knownBookingTotal', {
                    amount: trip.estimatedBookingCost.currency
                      ? formatLocaleMoney(
                          String(trip.estimatedBookingCost.amount),
                          trip.estimatedBookingCost.currency,
                          locale,
                        )
                      : String(trip.estimatedBookingCost.amount),
                  })}
            </p>
          ) : null}
        </header>
        <TripBudgetPlanner
          tripId={trip.id}
          budget={trip.budget}
          bookingCost={trip.estimatedBookingCost}
          readOnly={readOnly}
          onChanged={loadTrip}
        />
        <TripSharePanel tripId={trip.id} readOnly={readOnly} />
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
            {t('archivedNotice')}
          </p>
        ) : null}
        <TripAiAssistant
          tripId={trip.id}
          disabled={readOnly}
          onApplied={loadTrip}
        />
        <section className="mt-6 space-y-5" aria-label={t('itineraryDays')}>
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
  const t = useTranslations('trips');
  const bookingT = useTranslations('bookings');
  const paymentT = useTranslations('payment');
  const locale = resolveLocale(useLocale());
  const [notes, setNotes] = useState(day.notes ?? '');
  const [adding, setAdding] = useState(false);
  useEffect(() => setNotes(day.notes ?? ''), [day.notes]);
  return (
    <article className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-highland">
            {t('day', { count: day.dayNumber })}
          </p>
          <h2 className="mt-1 text-lg font-bold text-slate-950">
            {formatLocaleCalendarDate(day.date, locale)}
          </h2>
        </div>
        {!readOnly ? (
          <button
            type="button"
            onClick={() => setAdding((value) => !value)}
            className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t('addItem')}
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
            {t('dayNotes')}
          </label>
          <input
            id={`day-notes-${day.id}`}
            value={notes}
            maxLength={1000}
            onChange={(event) => setNotes(event.target.value)}
            placeholder={t('dayNotePlaceholder')}
            className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-highland focus:ring-2 focus:ring-highland/20"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
          >
            {t('saveNote')}
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
                      {t(itemTypeKey(item.type))}
                    </p>
                    <h3 className="text-sm font-semibold text-slate-950">
                      {item.title ?? t('itineraryItem')}
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
                      {t('bookingWithReference', {
                        reference: item.booking.reference,
                      })}
                    </Link>{' '}
                    · {item.booking.service.name} ·{' '}
                    {bookingT(
                      (
                        {
                          PENDING: 'pending',
                          CONFIRMED: 'confirmed',
                          REJECTED: 'rejected',
                          CANCELLED_BY_TRAVELER: 'cancelledByTraveler',
                          CANCELLED_BY_BUSINESS: 'cancelledByBusiness',
                          COMPLETED: 'completed',
                          NO_SHOW: 'noShow',
                        } as const
                      )[item.booking.bookingStatus],
                    )}{' '}
                    ·{' '}
                    {paymentT(
                      (
                        {
                          NOT_REQUIRED: 'notRequired',
                          UNPAID: 'unpaid',
                          PENDING: 'pending',
                          PAID: 'paidStatus',
                          PARTIALLY_REFUNDED: 'partiallyRefunded',
                          REFUNDED: 'refundedStatus',
                          FAILED: 'failed',
                        } as const
                      )[item.booking.paymentStatus],
                    )}
                  </div>
                ) : null}
              </div>
              {!readOnly ? (
                <div className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    aria-label={t('moveUp', {
                      name: item.title ?? t('itineraryItem'),
                    })}
                    disabled={busy || index === 0}
                    onClick={() => void onMoveItem(day, item, -1)}
                    className="rounded p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
                  >
                    <ChevronUp className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    aria-label={t('moveDown', {
                      name: item.title ?? t('itineraryItem'),
                    })}
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
                    {t('edit')}
                  </button>
                  <button
                    type="button"
                    aria-label={t('remove', {
                      name: item.title ?? t('itineraryItem'),
                    })}
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
            {t('nothingPlanned')}
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
  const t = useTranslations('trips');
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
        if (current) setFormError(t('bookingsLoadError'));
      }
    };
    void load();
    return () => {
      current = false;
    };
  }, [t, type]);

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
      setFormError(t('catalogLoadError'));
    } finally {
      setSearching(false);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    if (startTime && endTime && startTime >= endTime) {
      setFormError(t('endTimeInvalid'));
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
        setFormError(t('customTitleRequired'));
        return;
      }
      input.title = title.trim();
    } else {
      if (!targetId) {
        setFormError(
          type === 'BOOKING' ? t('chooseBooking') : t('choosePublicItem'),
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
        {t('addToDay', { count: day.dayNumber })}
      </h3>
      {formError ? (
        <p role="alert" className="mt-3 text-sm text-rose-800">
          {formError}
        </p>
      ) : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700">
          {t('itemType')}
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
                {t(itemTypeKey(option.value))}
              </option>
            ))}
          </select>
        </label>
        {type === 'CUSTOM' ? (
          <label className="text-sm font-semibold text-slate-700">
            {t('customTitle')}
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={180}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
        ) : (
          <label className="text-sm font-semibold text-slate-700">
            {type === 'BOOKING' ? t('yourBooking') : t('searchPublic')}
            <div className="mt-1 flex gap-2">
              {type !== 'BOOKING' ? (
                <>
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    maxLength={200}
                    placeholder={t('search')}
                    className="min-w-0 flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => void searchCatalog()}
                    disabled={searching || !query.trim()}
                    className="rounded-md border border-slate-300 px-3 text-sm font-semibold disabled:opacity-50"
                  >
                    {searching ? '…' : t('find')}
                  </button>
                </>
              ) : null}
            </div>
            <select
              value={targetId}
              onChange={(event) => setTargetId(event.target.value)}
              className="mt-2 block w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">{t('chooseItem')}</option>
              {choices.map((choice) => (
                <option key={choice.id} value={choice.id}>
                  {choice.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="text-sm font-semibold text-slate-700">
          {t('startTime')}{' '}
          <span className="font-normal text-slate-500">({t('optional')})</span>
          <input
            type="time"
            value={startTime}
            onChange={(event) => setStartTime(event.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="text-sm font-semibold text-slate-700">
          {t('endTime')}{' '}
          <span className="font-normal text-slate-500">({t('optional')})</span>
          <input
            type="time"
            value={endTime}
            onChange={(event) => setEndTime(event.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <label className="sm:col-span-2 text-sm font-semibold text-slate-700">
          {t('notes')}{' '}
          <span className="font-normal text-slate-500">({t('optional')})</span>
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
          {t('addItem')}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
        >
          {t('cancel')}
        </button>
      </div>
    </form>
  );
}

function messageFor(
  error: unknown,
  fallback: string,
  messages: TripErrorMessages,
): string {
  if (error instanceof BffRequestError && error.status === 401)
    return messages.sessionEnded;
  if (error instanceof BffRequestError && error.status === 403)
    return messages.changeDenied;
  if (error instanceof BffRequestError && error.status === 404)
    return messages.itemUnavailable;
  return fallback;
}
