'use client';

import { ServiceWorkspaceHeader } from './ServiceWorkspaceHeader';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import {
  canEditBusiness,
  getManagedBusiness,
} from '../../lib/business-management';
import {
  createManagedTourItineraryItem,
  getManagedTour,
  operationError,
  updateManagedTour,
  updateManagedTourItineraryItem,
} from '../../lib/business-operations';
import type {
  ManagedTour,
  ManagedTourItineraryItem,
  TourItineraryItemInput,
} from '../../lib/business-operations';

type DetailFields = {
  durationDays: string;
  difficulty: string;
  meetingPoint: string;
  inclusions: string;
  exclusions: string;
};
type ItineraryFields = {
  dayNumber: string;
  title: string;
  description: string;
  sortOrder: string;
};

const blankDetail = (): DetailFields => ({
  durationDays: '',
  difficulty: '',
  meetingPoint: '',
  inclusions: '',
  exclusions: '',
});
const blankItinerary = (): ItineraryFields => ({
  dayNumber: '1',
  title: '',
  description: '',
  sortOrder: '0',
});

function detailValues(tour: ManagedTour): DetailFields {
  return {
    durationDays: tour.detail?.durationDays
      ? String(tour.detail.durationDays)
      : '',
    difficulty: tour.detail?.difficulty ?? '',
    meetingPoint: tour.detail?.meetingPoint ?? '',
    inclusions: tour.detail?.inclusions.join(', ') ?? '',
    exclusions: tour.detail?.exclusions.join(', ') ?? '',
  };
}

function itineraryValues(item: ManagedTourItineraryItem): ItineraryFields {
  return {
    dayNumber: String(item.dayNumber),
    title: item.title,
    description: item.description ?? '',
    sortOrder: String(item.sortOrder),
  };
}

function positiveInteger(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 1 ? parsed : null;
}

function nonNegativeInteger(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

function labels(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export function BusinessTourClient({
  businessId,
  serviceId,
}: {
  businessId: string;
  serviceId: string;
}) {
  const t = useTranslations('businessPortal');
  const [tour, setTour] = useState<ManagedTour | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [detail, setDetail] = useState<DetailFields>(blankDetail);
  const [itinerary, setItinerary] = useState<ItineraryFields>(blankItinerary);
  const [editingItem, setEditingItem] =
    useState<ManagedTourItineraryItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [data, business] = await Promise.all([
        getManagedTour(businessId, serviceId),
        getManagedBusiness(businessId),
      ]);
      setTour(data);
      setDetail(detailValues(data));
      setCanWrite(canEditBusiness(business));
    } catch (reason) {
      setError(operationError(reason, t('loadTourError')));
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
    const durationDays = detail.durationDays.trim()
      ? positiveInteger(detail.durationDays)
      : undefined;
    const inclusions = labels(detail.inclusions);
    const exclusions = labels(detail.exclusions);
    if (
      (detail.durationDays.trim() && (!durationDays || durationDays > 365)) ||
      detail.difficulty.trim().length > 40 ||
      detail.meetingPoint.trim().length > 240 ||
      inclusions.length > 30 ||
      exclusions.length > 30 ||
      inclusions.some((item) => item.length > 300) ||
      exclusions.some((item) => item.length > 300)
    ) {
      setError(t('tourDetailInvalid'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateManagedTour(businessId, serviceId, {
        ...(durationDays ? { durationDays } : {}),
        ...(detail.difficulty.trim()
          ? { difficulty: detail.difficulty.trim() }
          : {}),
        ...(detail.meetingPoint.trim()
          ? { meetingPoint: detail.meetingPoint.trim() }
          : {}),
        inclusions,
        exclusions,
      });
      setTour(updated);
      setDetail(detailValues(updated));
    } catch (reason) {
      setError(operationError(reason, t('saveTourError')));
    } finally {
      setSaving(false);
    }
  }

  function itineraryInput(): TourItineraryItemInput | null {
    const dayNumber = positiveInteger(itinerary.dayNumber);
    const sortOrder = nonNegativeInteger(itinerary.sortOrder);
    if (
      dayNumber === null ||
      sortOrder === null ||
      itinerary.title.trim().length < 1 ||
      itinerary.title.trim().length > 180 ||
      itinerary.description.trim().length > 2000
    ) {
      setError(t('itineraryItemInvalid'));
      return null;
    }
    if (
      tour?.detail?.durationDays !== null &&
      tour?.detail?.durationDays !== undefined &&
      dayNumber > tour.detail.durationDays
    ) {
      setError(t('itineraryDayInvalid'));
      return null;
    }
    return {
      dayNumber,
      title: itinerary.title.trim(),
      description: itinerary.description.trim() || null,
      sortOrder,
    };
  }

  async function saveItinerary(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite || saving) return;
    const input = itineraryInput();
    if (!input) return;
    setSaving(true);
    setError(null);
    try {
      if (editingItem) {
        await updateManagedTourItineraryItem(
          businessId,
          serviceId,
          editingItem.id,
          input,
        );
      } else {
        await createManagedTourItineraryItem(businessId, serviceId, input);
      }
      setItinerary(blankItinerary());
      setEditingItem(null);
      await load();
    } catch (reason) {
      setError(operationError(reason, t('saveItineraryItemError')));
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="rounded-md bg-white p-5 text-sm text-slate-500">
        {t('loadingTour')}
      </p>
    );
  }

  return (
    <main className="bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <ServiceWorkspaceHeader
          businessId={businessId}
          serviceId={serviceId}
          serviceName={tour?.service.name ?? t('tourDetails')}
          serviceStatus={tour?.service.status ?? 'DRAFT'}
          categoryName={tour?.service.category.name ?? t('tourDetails')}
          categoryFamily="TOUR"
          canWrite={canWrite}
          currentSection="category"
          description={t('tourDetails')}
        />
        {error ? (
          <p
            role="alert"
            className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            {error}
          </p>
        ) : null}
        {tour ? (
          <>
            <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">
                {t('tourDetails')}
              </h2>
              <form
                onSubmit={(event) => void saveDetail(event)}
                className="mt-4 grid gap-4 sm:grid-cols-2"
              >
                <label className="text-sm font-semibold text-slate-700">
                  {t('durationDays')}
                  <input
                    disabled={!canWrite || saving}
                    inputMode="numeric"
                    value={detail.durationDays}
                    onChange={(event) =>
                      setDetail((current) => ({
                        ...current,
                        durationDays: event.target.value,
                      }))
                    }
                    className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5 disabled:bg-slate-100"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  {t('difficulty')}{' '}
                  <span className="font-normal">({t('optional')})</span>
                  <input
                    disabled={!canWrite || saving}
                    maxLength={40}
                    value={detail.difficulty}
                    onChange={(event) =>
                      setDetail((current) => ({
                        ...current,
                        difficulty: event.target.value,
                      }))
                    }
                    className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5 disabled:bg-slate-100"
                  />
                </label>
                <label className="sm:col-span-2 text-sm font-semibold text-slate-700">
                  {t('meetingPoint')}{' '}
                  <span className="font-normal">({t('optional')})</span>
                  <input
                    disabled={!canWrite || saving}
                    maxLength={240}
                    value={detail.meetingPoint}
                    onChange={(event) =>
                      setDetail((current) => ({
                        ...current,
                        meetingPoint: event.target.value,
                      }))
                    }
                    className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5 disabled:bg-slate-100"
                  />
                </label>
                <label className="sm:col-span-2 text-sm font-semibold text-slate-700">
                  {t('inclusions')}{' '}
                  <span className="font-normal">({t('commaSeparated')})</span>
                  <textarea
                    disabled={!canWrite || saving}
                    maxLength={9029}
                    value={detail.inclusions}
                    onChange={(event) =>
                      setDetail((current) => ({
                        ...current,
                        inclusions: event.target.value,
                      }))
                    }
                    className="mt-1.5 min-h-20 w-full rounded-md border border-slate-300 p-2.5 disabled:bg-slate-100"
                  />
                </label>
                <label className="sm:col-span-2 text-sm font-semibold text-slate-700">
                  {t('exclusions')}{' '}
                  <span className="font-normal">({t('commaSeparated')})</span>
                  <textarea
                    disabled={!canWrite || saving}
                    maxLength={9029}
                    value={detail.exclusions}
                    onChange={(event) =>
                      setDetail((current) => ({
                        ...current,
                        exclusions: event.target.value,
                      }))
                    }
                    className="mt-1.5 min-h-20 w-full rounded-md border border-slate-300 p-2.5 disabled:bg-slate-100"
                  />
                </label>
                {canWrite ? (
                  <div className="sm:col-span-2">
                    <button
                      disabled={saving}
                      className="rounded-md bg-highland px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {saving ? t('saving') : t('saveTourDetails')}
                    </button>
                  </div>
                ) : null}
              </form>
            </section>

            {canWrite ? (
              <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-slate-950">
                    {editingItem
                      ? t('editItineraryItem')
                      : t('addItineraryItem')}
                  </h2>
                  {editingItem ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingItem(null);
                        setItinerary(blankItinerary());
                      }}
                      className="text-sm font-semibold text-slate-600"
                    >
                      {t('cancelEdit')}
                    </button>
                  ) : null}
                </div>
                {!tour.detail ? (
                  <p className="mt-3 text-sm text-slate-600">
                    {t('saveTourBeforeItinerary')}
                  </p>
                ) : (
                  <form
                    onSubmit={(event) => void saveItinerary(event)}
                    className="mt-4 grid gap-4 sm:grid-cols-2"
                  >
                    <label className="text-sm font-semibold text-slate-700">
                      {t('dayNumber')}
                      <input
                        required
                        disabled={saving}
                        inputMode="numeric"
                        value={itinerary.dayNumber}
                        onChange={(event) =>
                          setItinerary((current) => ({
                            ...current,
                            dayNumber: event.target.value,
                          }))
                        }
                        className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5"
                      />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      {t('sortOrder')}
                      <input
                        required
                        disabled={saving}
                        inputMode="numeric"
                        value={itinerary.sortOrder}
                        onChange={(event) =>
                          setItinerary((current) => ({
                            ...current,
                            sortOrder: event.target.value,
                          }))
                        }
                        className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5"
                      />
                    </label>
                    <label className="sm:col-span-2 text-sm font-semibold text-slate-700">
                      {t('title')}
                      <input
                        required
                        disabled={saving}
                        maxLength={180}
                        value={itinerary.title}
                        onChange={(event) =>
                          setItinerary((current) => ({
                            ...current,
                            title: event.target.value,
                          }))
                        }
                        className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5"
                      />
                    </label>
                    <label className="sm:col-span-2 text-sm font-semibold text-slate-700">
                      {t('description')}{' '}
                      <span className="font-normal">({t('optional')})</span>
                      <textarea
                        disabled={saving}
                        maxLength={2000}
                        value={itinerary.description}
                        onChange={(event) =>
                          setItinerary((current) => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                        className="mt-1.5 min-h-24 w-full rounded-md border border-slate-300 p-2.5"
                      />
                    </label>
                    <div className="sm:col-span-2">
                      <button
                        disabled={saving}
                        className="rounded-md bg-highland px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {saving
                          ? t('saving')
                          : editingItem
                            ? t('saveItineraryItem')
                            : t('addItineraryItem')}
                      </button>
                    </div>
                  </form>
                )}
              </section>
            ) : null}

            <section className="mt-6">
              <h2 className="text-lg font-bold text-slate-950">
                {t('itinerary')}
              </h2>
              <div className="mt-3 space-y-3">
                {tour.itinerary.length ? (
                  tour.itinerary.map((item) => (
                    <article
                      key={item.id}
                      className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold uppercase tracking-wide text-highland">
                            {t('dayNumber')} {item.dayNumber}
                          </p>
                          <h3 className="mt-1 font-bold text-slate-950">
                            {item.title}
                          </h3>
                          {item.description ? (
                            <p className="mt-1 text-sm text-slate-600">
                              {item.description}
                            </p>
                          ) : null}
                        </div>
                        {canWrite ? (
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => {
                              setEditingItem(item);
                              setItinerary(itineraryValues(item));
                            }}
                            className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                          >
                            {t('editItineraryItem')}
                          </button>
                        ) : null}
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
                    {t('noItineraryItems')}
                  </p>
                )}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}
