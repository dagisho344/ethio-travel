'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { CalendarClock, Loader2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  formatMoney,
  paymentStatusLabel,
  safeReturnTo,
} from '../../lib/bookings';
import type {
  AvailabilityResponse,
  Booking,
  BookingMode,
  PricingModel,
} from '../../lib/types';

type Stage =
  'idle' | 'checking' | 'available' | 'unavailable' | 'creating' | 'created';

class BookingRequestError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

function localInput(daysFromNow: number, hour: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(hour, 0, 0, 0);
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function isoFromLocal(value: string): string {
  return new Date(value).toISOString();
}

async function readJson<T>(response: Response): Promise<T> {
  const data = (await response.json().catch(() => null)) as {
    message?: string;
  } | null;
  if (!response.ok) {
    throw new BookingRequestError(
      response.status,
      data?.message ?? 'Request failed.',
    );
  }
  return data as T;
}

function modeLabel(mode?: BookingMode) {
  if (mode === 'DATE') return 'Date booking';
  if (mode === 'DATE_RANGE') return 'Date range booking';
  if (mode === 'TIME_SLOT') return 'Time-slot booking';
  return 'Booking';
}

export function BookingWidget({
  serviceId,
  serviceName,
  pricingModel,
  price,
  currency,
  compact = false,
}: {
  serviceId: string;
  serviceName: string;
  pricingModel?: PricingModel;
  price?: string | number | null;
  currency?: string | null;
  compact?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);
  const [startAt, setStartAt] = useState(localInput(2, 9));
  const [endAt, setEndAt] = useState(localInput(2, 10));
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(
    null,
  );
  const [booking, setBooking] = useState<Booking | null>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [error, setError] = useState<string | null>(null);

  const returnTo = useMemo(
    () =>
      safeReturnTo(pathname, searchParams.toString() ? `?${searchParams}` : ''),
    [pathname, searchParams],
  );

  async function checkAvailability() {
    setError(null);
    setBooking(null);
    setStage('checking');
    try {
      const params = new URLSearchParams({
        startAt: isoFromLocal(startAt),
        endAt: isoFromLocal(endAt),
        quantity: String(quantity),
      });
      const response = await fetch(
        `/api/services/${serviceId}/availability?${params}`,
        {
          cache: 'no-store',
        },
      );
      const data = await readJson<AvailabilityResponse>(response);
      setAvailability(data);
      setStage(data.available ? 'available' : 'unavailable');
      if (!data.available)
        setError(
          'This time is not available. Try another date, time or quantity.',
        );
    } catch (err) {
      setAvailability(null);
      setStage('idle');
      setError(
        err instanceof BookingRequestError && err.status === 409
          ? 'This service is not bookable for the selected time.'
          : 'We could not check availability right now.',
      );
    }
  }

  async function createBooking() {
    setError(null);
    setStage('creating');
    try {
      const response = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          serviceId,
          startAt: isoFromLocal(startAt),
          endAt: isoFromLocal(endAt),
          quantity,
          travelerNote: note.trim() || undefined,
        }),
      });
      if (response.status === 401) {
        router.push(`/login?returnTo=${encodeURIComponent(returnTo)}`);
        return;
      }
      const data = await readJson<Booking>(response);
      setBooking(data);
      setAvailability(null);
      setStage('created');
      router.refresh();
    } catch (err) {
      if (err instanceof BookingRequestError && err.status === 409) {
        setStage('idle');
        setError(
          'Availability changed before booking was created. Check availability again.',
        );
        await checkAvailability();
        return;
      }
      setStage('available');
      setError('We could not create this booking right now.');
    }
  }

  return (
    <div
      className={
        compact
          ? 'mt-4 border-t border-slate-100 pt-4'
          : 'rounded-lg border border-slate-200 bg-white p-4 shadow-sm'
      }
    >
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex w-full items-center justify-center gap-2 rounded-md bg-highland px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2"
        >
          <CalendarClock className="h-4 w-4" aria-hidden="true" />
          Book now
        </button>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-bold text-slate-950">
              Book {serviceName}
            </p>
            {pricingModel ? (
              <p className="mt-1 text-xs text-slate-500">
                Server confirms final booking price. Listed price:{' '}
                {formatMoney(price, currency)}
              </p>
            ) : null}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-slate-600">
              Start
              <input
                type="datetime-local"
                value={startAt}
                onChange={(event) => {
                  setStartAt(event.target.value);
                  setAvailability(null);
                  setBooking(null);
                  setStage('idle');
                }}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-highland focus:outline-none focus:ring-2 focus:ring-highland/20"
              />
            </label>
            <label className="text-xs font-semibold text-slate-600">
              End
              <input
                type="datetime-local"
                value={endAt}
                onChange={(event) => {
                  setEndAt(event.target.value);
                  setAvailability(null);
                  setBooking(null);
                  setStage('idle');
                }}
                className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-highland focus:outline-none focus:ring-2 focus:ring-highland/20"
              />
            </label>
          </div>
          <label className="block text-xs font-semibold text-slate-600">
            Quantity
            <input
              type="number"
              min="1"
              max="100"
              value={quantity}
              onChange={(event) => {
                setQuantity(Math.max(1, Number(event.target.value) || 1));
                setAvailability(null);
                setBooking(null);
                setStage('idle');
              }}
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-highland focus:outline-none focus:ring-2 focus:ring-highland/20"
            />
          </label>
          <label className="block text-xs font-semibold text-slate-600">
            Traveler note optional
            <textarea
              maxLength={1000}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="mt-1 min-h-20 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-highland focus:outline-none focus:ring-2 focus:ring-highland/20"
            />
          </label>

          {availability ? (
            <div className="rounded-md bg-slate-50 p-3 text-sm text-slate-700">
              <p className="font-semibold text-slate-950">
                {modeLabel(availability.bookingMode)}
              </p>
              <p className="mt-1">
                Remaining capacity: {availability.remaining}
              </p>
            </div>
          ) : null}

          {booking ? (
            <div
              className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-900"
              role="status"
            >
              <p className="font-semibold">
                Booking requested: {booking.reference}
              </p>
              <p className="mt-1">
                Status: {booking.bookingStatus}. Payment:{' '}
                {paymentStatusLabel(booking.paymentStatus)}.
              </p>
              <Link
                className="mt-2 inline-block font-semibold text-highland"
                href={`/bookings/${booking.id}`}
              >
                View booking details
              </Link>
            </div>
          ) : null}

          {error ? (
            <p
              className="rounded-md bg-amber-50 p-3 text-sm text-amber-900"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={stage === 'checking' || stage === 'creating'}
              onClick={() => void checkAvailability()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-highland hover:text-highland focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {stage === 'checking' ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              Check availability
            </button>
            <button
              type="button"
              disabled={stage !== 'available'}
              onClick={() => void createBooking()}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-md bg-highland px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-highland focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {stage === 'creating' ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              Request booking
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
