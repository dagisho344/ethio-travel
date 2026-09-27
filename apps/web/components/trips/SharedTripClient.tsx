'use client';

import { useEffect, useRef, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Container } from '../../components/ui/Container';
import { BffRequestError, bffJson } from '../../lib/private-api';
import { resolveLocale } from '../../i18n/config';
import { formatLocaleCalendarDate } from '../../i18n/format';
import type { SharedTrip } from '../../lib/types';

export function SharedTripClient() {
  const t = useTranslations('tripSharing');
  const locale = resolveLocale(useLocale());
  const translationsRef = useRef(t);
  translationsRef.current = t;
  const [trip, setTrip] = useState<SharedTrip | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = window.location.hash.slice(1);
    window.history.replaceState(null, '', window.location.pathname);
    if (!token) {
      setError(translationsRef.current('linkIncomplete'));
      setLoading(false);
      return;
    }
    let active = true;
    void bffJson<SharedTrip>('/api/trip-shares/resolve', {
      method: 'POST',
      body: JSON.stringify({ token }),
    })
      .then((result) => {
        if (active) setTrip(result);
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(
            requestError instanceof BffRequestError &&
              requestError.status === 404
              ? translationsRef.current('linkUnavailable')
              : translationsRef.current('openError'),
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <main className="bg-slate-50">
      <Container className="max-w-3xl py-10 sm:py-14">
        {loading ? (
          <p className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
            {t('opening')}
          </p>
        ) : error || !trip ? (
          <p
            role="alert"
            className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900"
          >
            {error ?? t('linkUnavailable')}
          </p>
        ) : (
          <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <p className="text-sm font-semibold text-highland">
              {t('sharedItinerary')}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              {trip.title}
            </h1>
            <p className="mt-3 text-sm font-medium text-slate-700">
              {formatLocaleCalendarDate(trip.startDate, locale)} –{' '}
              {formatLocaleCalendarDate(trip.endDate, locale)}
            </p>
            {trip.destinations.map((destination) => (
              <p
                key={`${destination.name}-${destination.cityName}`}
                className="mt-2 text-sm text-slate-600"
              >
                {destination.name} · {destination.cityName},{' '}
                {destination.regionName}
              </p>
            ))}
            <ol className="mt-8 space-y-6" aria-label={t('sharedItinerary')}>
              {trip.days.map((day) => (
                <li
                  key={`${day.date}-${day.dayNumber}`}
                  className="border-t border-slate-100 pt-5 first:border-t-0 first:pt-0"
                >
                  <h2 className="font-bold text-slate-900">
                    {t('sharedDay', { count: day.dayNumber })} ·{' '}
                    {formatLocaleCalendarDate(day.date, locale)}
                  </h2>
                  {day.items.length ? (
                    <ul className="mt-3 space-y-2">
                      {day.items.map((item, index) => (
                        <li
                          key={`${item.type}-${item.title}-${index}`}
                          className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700"
                        >
                          <span className="font-medium text-slate-900">
                            {item.title}
                          </span>
                          {item.startTime ? ` · ${item.startTime}` : ''}
                          {item.endTime ? `–${item.endTime}` : ''}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">
                      {t('publicEmpty')}
                    </p>
                  )}
                </li>
              ))}
            </ol>
            {trip.truncated ? (
              <p className="mt-6 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {t('publicTruncated')}
              </p>
            ) : null}
          </article>
        )}
      </Container>
    </main>
  );
}
