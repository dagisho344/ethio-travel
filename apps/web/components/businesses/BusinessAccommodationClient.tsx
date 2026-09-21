'use client';

import { ServiceWorkspaceHeader } from './ServiceWorkspaceHeader';
import { useEffect, useState } from 'react';
import {
  canEditBusiness,
  getManagedBusiness,
} from '../../lib/business-management';
import {
  createManagedRoomType,
  getManagedAccommodation,
  operationError,
  roomTypeAction,
  updateManagedAccommodation,
  updateManagedRoomType,
} from '../../lib/business-operations';
import type {
  ManagedAccommodation,
  ManagedRoomType,
  RoomTypeInput,
} from '../../lib/business-operations';

type DetailFields = {
  starClass: string;
  checkInTime: string;
  checkOutTime: string;
};
type RoomFields = {
  name: string;
  description: string;
  capacity: string;
  basePrice: string;
  currency: string;
  quantity: string;
};

const moneyPattern = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
const blankDetail = (): DetailFields => ({
  starClass: '',
  checkInTime: '',
  checkOutTime: '',
});
const blankRoom = (): RoomFields => ({
  name: '',
  description: '',
  capacity: '1',
  basePrice: '',
  currency: 'ETB',
  quantity: '0',
});

function detailValues(accommodation: ManagedAccommodation): DetailFields {
  return {
    starClass:
      accommodation.detail?.starClass === null ||
      accommodation.detail?.starClass === undefined
        ? ''
        : String(accommodation.detail.starClass),
    checkInTime: accommodation.detail?.checkInTime ?? '',
    checkOutTime: accommodation.detail?.checkOutTime ?? '',
  };
}

function roomValues(room: ManagedRoomType): RoomFields {
  return {
    name: room.name,
    description: room.description ?? '',
    capacity: String(room.capacity),
    basePrice: room.basePrice,
    currency: room.currency,
    quantity: String(room.quantity),
  };
}

export function BusinessAccommodationClient({
  businessId,
  serviceId,
}: {
  businessId: string;
  serviceId: string;
}) {
  const [accommodation, setAccommodation] =
    useState<ManagedAccommodation | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [detail, setDetail] = useState<DetailFields>(blankDetail);
  const [room, setRoom] = useState<RoomFields>(blankRoom);
  const [editingRoom, setEditingRoom] = useState<ManagedRoomType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [data, business] = await Promise.all([
        getManagedAccommodation(businessId, serviceId),
        getManagedBusiness(businessId),
      ]);
      setAccommodation(data);
      setDetail(detailValues(data));
      setCanWrite(canEditBusiness(business));
    } catch (reason) {
      setError(
        operationError(reason, 'Accommodation details could not be loaded.'),
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, [businessId, serviceId]);

  function changeDetail(key: keyof DetailFields, value: string) {
    setDetail((current) => ({ ...current, [key]: value }));
  }

  function changeRoom(key: keyof RoomFields, value: string) {
    setRoom((current) => ({ ...current, [key]: value }));
  }

  async function saveDetail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite || saving) return;
    const starClass = detail.starClass.trim();
    if (
      (starClass !== '' &&
        (!Number.isInteger(Number(starClass)) ||
          Number(starClass) < 1 ||
          Number(starClass) > 5)) ||
      (detail.checkInTime !== '' && !timePattern.test(detail.checkInTime)) ||
      (detail.checkOutTime !== '' && !timePattern.test(detail.checkOutTime))
    ) {
      setError('Use a 1–5 star class and 24-hour times in HH:mm format.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateManagedAccommodation(businessId, serviceId, {
        starClass: starClass === '' ? null : Number(starClass),
        checkInTime: detail.checkInTime || null,
        checkOutTime: detail.checkOutTime || null,
      });
      setAccommodation(updated);
      setDetail(detailValues(updated));
    } catch (reason) {
      setError(
        operationError(reason, 'Accommodation details could not be saved.'),
      );
    } finally {
      setSaving(false);
    }
  }

  function roomInput(): RoomTypeInput | null {
    const capacity = Number(room.capacity);
    const quantity = Number(room.quantity);
    const price = room.basePrice.trim();
    const currency = room.currency.trim().toUpperCase();
    if (
      room.name.trim().length < 1 ||
      !Number.isInteger(capacity) ||
      capacity < 1 ||
      !Number.isInteger(quantity) ||
      quantity < 0 ||
      !moneyPattern.test(price) ||
      !/^[A-Z]{3}$/.test(currency)
    ) {
      setError(
        'Enter a room name, positive capacity, non-negative quantity and price, and a three-letter currency.',
      );
      return null;
    }
    return {
      name: room.name.trim(),
      description: room.description.trim() || null,
      capacity,
      basePrice: price,
      currency,
      quantity,
    };
  }

  async function saveRoom(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite || saving) return;
    const input = roomInput();
    if (!input) return;
    setSaving(true);
    setError(null);
    try {
      if (editingRoom) {
        await updateManagedRoomType(
          businessId,
          serviceId,
          editingRoom.id,
          input,
        );
      } else {
        await createManagedRoomType(businessId, serviceId, input);
      }
      setRoom(blankRoom());
      setEditingRoom(null);
      await load();
    } catch (reason) {
      setError(operationError(reason, 'The room type could not be saved.'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleRoom(roomType: ManagedRoomType) {
    if (!canWrite || saving) return;
    setSaving(true);
    setError(null);
    try {
      await roomTypeAction(
        businessId,
        serviceId,
        roomType.id,
        roomType.isActive ? 'deactivate' : 'activate',
      );
      await load();
    } catch (reason) {
      setError(
        operationError(reason, 'The room type status could not be changed.'),
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="rounded-md bg-white p-5 text-sm text-slate-500">
        Loading accommodation details...
      </p>
    );
  }

  return (
    <main className="bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <ServiceWorkspaceHeader
          businessId={businessId}
          serviceId={serviceId}
          serviceName={accommodation?.service.name ?? 'Accommodation Details'}
          serviceStatus={accommodation?.service.status ?? 'DRAFT'}
          categoryName={
            accommodation?.service.category.name ?? 'Accommodation Details'
          }
          categoryFamily="ACCOMMODATION"
          canWrite={canWrite}
          currentSection="category"
          description="Configure guest-facing accommodation information and room types. Room inventory remains separate from booking availability."
        />
        {error ? (
          <p
            role="alert"
            className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            {error}
          </p>
        ) : null}
        {accommodation ? (
          <>
            <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">
                Property details
              </h2>
              <form
                onSubmit={(event) => void saveDetail(event)}
                className="mt-4 grid gap-4 sm:grid-cols-3"
              >
                <label className="text-sm font-semibold text-slate-700">
                  Star class <span className="font-normal">(optional)</span>
                  <input
                    disabled={!canWrite || saving}
                    inputMode="numeric"
                    value={detail.starClass}
                    onChange={(event) =>
                      changeDetail('starClass', event.target.value)
                    }
                    className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5 disabled:bg-slate-100"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Check-in time <span className="font-normal">(HH:mm)</span>
                  <input
                    disabled={!canWrite || saving}
                    placeholder="14:00"
                    value={detail.checkInTime}
                    onChange={(event) =>
                      changeDetail('checkInTime', event.target.value)
                    }
                    className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5 disabled:bg-slate-100"
                  />
                </label>
                <label className="text-sm font-semibold text-slate-700">
                  Check-out time <span className="font-normal">(HH:mm)</span>
                  <input
                    disabled={!canWrite || saving}
                    placeholder="11:00"
                    value={detail.checkOutTime}
                    onChange={(event) =>
                      changeDetail('checkOutTime', event.target.value)
                    }
                    className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5 disabled:bg-slate-100"
                  />
                </label>
                {canWrite ? (
                  <div className="sm:col-span-3">
                    <button
                      disabled={saving}
                      className="rounded-md bg-highland px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {saving ? 'Saving...' : 'Save property details'}
                    </button>
                  </div>
                ) : null}
              </form>
            </section>
            {canWrite ? (
              <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-slate-950">
                    {editingRoom ? 'Edit room type' : 'Add room type'}
                  </h2>
                  {editingRoom ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRoom(null);
                        setRoom(blankRoom());
                      }}
                      className="text-sm font-semibold text-slate-600"
                    >
                      Cancel edit
                    </button>
                  ) : null}
                </div>
                {!accommodation.detail ? (
                  <p className="mt-3 text-sm text-slate-600">
                    Save property details first to add room types.
                  </p>
                ) : (
                  <form
                    onSubmit={(event) => void saveRoom(event)}
                    className="mt-4 grid gap-4 sm:grid-cols-2"
                  >
                    <label className="text-sm font-semibold text-slate-700">
                      Room name
                      <input
                        required
                        disabled={saving}
                        maxLength={180}
                        value={room.name}
                        onChange={(event) =>
                          changeRoom('name', event.target.value)
                        }
                        className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5"
                      />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      Capacity
                      <input
                        required
                        disabled={saving}
                        inputMode="numeric"
                        value={room.capacity}
                        onChange={(event) =>
                          changeRoom('capacity', event.target.value)
                        }
                        className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5"
                      />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      Base price
                      <input
                        required
                        disabled={saving}
                        inputMode="decimal"
                        value={room.basePrice}
                        onChange={(event) =>
                          changeRoom('basePrice', event.target.value)
                        }
                        className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5"
                      />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      Currency
                      <input
                        required
                        disabled={saving}
                        maxLength={3}
                        value={room.currency}
                        onChange={(event) =>
                          changeRoom(
                            'currency',
                            event.target.value.toUpperCase(),
                          )
                        }
                        className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5"
                      />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      Quantity
                      <input
                        required
                        disabled={saving}
                        inputMode="numeric"
                        value={room.quantity}
                        onChange={(event) =>
                          changeRoom('quantity', event.target.value)
                        }
                        className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5"
                      />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      Description{' '}
                      <span className="font-normal">(optional)</span>
                      <input
                        disabled={saving}
                        maxLength={1000}
                        value={room.description}
                        onChange={(event) =>
                          changeRoom('description', event.target.value)
                        }
                        className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5"
                      />
                    </label>
                    <div className="sm:col-span-2">
                      <button
                        disabled={saving}
                        className="rounded-md bg-highland px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                      >
                        {saving
                          ? 'Saving...'
                          : editingRoom
                            ? 'Save room type'
                            : 'Add room type'}
                      </button>
                    </div>
                  </form>
                )}
              </section>
            ) : null}
            <section className="mt-6">
              <h2 className="text-lg font-bold text-slate-950">Room types</h2>
              <div className="mt-3 space-y-3">
                {accommodation.roomTypes.length ? (
                  accommodation.roomTypes.map((roomType) => (
                    <article
                      key={roomType.id}
                      className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-slate-950">
                              {roomType.name}
                            </h3>
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-semibold ${roomType.isActive ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}
                            >
                              {roomType.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          {roomType.description ? (
                            <p className="mt-1 text-sm text-slate-600">
                              {roomType.description}
                            </p>
                          ) : null}
                          <p className="mt-3 text-sm text-slate-700">
                            Capacity: {roomType.capacity} · Quantity:{' '}
                            {roomType.quantity} · {roomType.currency}{' '}
                            {roomType.basePrice}
                          </p>
                        </div>
                        {canWrite ? (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => {
                                setEditingRoom(roomType);
                                setRoom(roomValues(roomType));
                              }}
                              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void toggleRoom(roomType)}
                              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                            >
                              {roomType.isActive ? 'Deactivate' : 'Activate'}
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
                    No room types have been added yet.
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
