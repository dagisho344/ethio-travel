'use client';

import { ServiceWorkspaceHeader } from './ServiceWorkspaceHeader';
import { useEffect, useState } from 'react';
import {
  canEditBusiness,
  getManagedBusiness,
} from '../../lib/business-management';
import {
  createManagedRestaurantMenu,
  createManagedRestaurantMenuItem,
  getManagedRestaurant,
  operationError,
  restaurantMenuAction,
  restaurantMenuItemAction,
  updateManagedRestaurant,
  updateManagedRestaurantMenu,
  updateManagedRestaurantMenuItem,
} from '../../lib/business-operations';
import type {
  ManagedRestaurant,
  ManagedRestaurantMenu,
  ManagedRestaurantMenuItem,
  RestaurantMenuInput,
  RestaurantMenuItemInput,
} from '../../lib/business-operations';

type DetailFields = {
  cuisineTypes: string;
  reservationSupported: boolean;
  deliverySupported: boolean;
};
type MenuFields = {
  name: string;
  description: string;
  sortOrder: string;
};
type MenuItemFields = {
  section: string;
  name: string;
  description: string;
  price: string;
  currency: string;
  sortOrder: string;
};
type EditingItem = { menuId: string; item: ManagedRestaurantMenuItem | null };

const moneyPattern = /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/;
const blankDetail = (): DetailFields => ({
  cuisineTypes: '',
  reservationSupported: false,
  deliverySupported: false,
});
const blankMenu = (): MenuFields => ({
  name: '',
  description: '',
  sortOrder: '0',
});
const blankItem = (): MenuItemFields => ({
  section: '',
  name: '',
  description: '',
  price: '',
  currency: 'ETB',
  sortOrder: '0',
});

function detailValues(restaurant: ManagedRestaurant): DetailFields {
  return {
    cuisineTypes: restaurant.detail?.cuisineTypes.join(', ') ?? '',
    reservationSupported: restaurant.detail?.reservationSupported ?? false,
    deliverySupported: restaurant.detail?.deliverySupported ?? false,
  };
}

function menuValues(menu: ManagedRestaurantMenu): MenuFields {
  return {
    name: menu.name,
    description: menu.description ?? '',
    sortOrder: String(menu.sortOrder),
  };
}

function itemValues(item: ManagedRestaurantMenuItem): MenuItemFields {
  return {
    section: item.section ?? '',
    name: item.name,
    description: item.description ?? '',
    price: item.price,
    currency: item.currency,
    sortOrder: String(item.sortOrder),
  };
}

function nonNegativeInteger(value: string): number | null {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function BusinessRestaurantClient({
  businessId,
  serviceId,
}: {
  businessId: string;
  serviceId: string;
}) {
  const [restaurant, setRestaurant] = useState<ManagedRestaurant | null>(null);
  const [canWrite, setCanWrite] = useState(false);
  const [detail, setDetail] = useState<DetailFields>(blankDetail);
  const [menu, setMenu] = useState<MenuFields>(blankMenu);
  const [item, setItem] = useState<MenuItemFields>(blankItem);
  const [editingMenu, setEditingMenu] = useState<ManagedRestaurantMenu | null>(
    null,
  );
  const [editingItem, setEditingItem] = useState<EditingItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const [data, business] = await Promise.all([
        getManagedRestaurant(businessId, serviceId),
        getManagedBusiness(businessId),
      ]);
      setRestaurant(data);
      setDetail(detailValues(data));
      setCanWrite(canEditBusiness(business));
    } catch (reason) {
      setError(
        operationError(reason, 'Restaurant details could not be loaded.'),
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
    const cuisineTypes = detail.cuisineTypes
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    if (
      cuisineTypes.length > 20 ||
      cuisineTypes.some((value) => value.length > 80)
    ) {
      setError('Use at most 20 cuisine types, each at most 80 characters.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const updated = await updateManagedRestaurant(businessId, serviceId, {
        cuisineTypes,
        reservationSupported: detail.reservationSupported,
        deliverySupported: detail.deliverySupported,
      });
      setRestaurant(updated);
      setDetail(detailValues(updated));
    } catch (reason) {
      setError(
        operationError(reason, 'Restaurant details could not be saved.'),
      );
    } finally {
      setSaving(false);
    }
  }

  function menuInput(): RestaurantMenuInput | null {
    const sortOrder = nonNegativeInteger(menu.sortOrder);
    if (
      menu.name.trim().length < 1 ||
      menu.name.trim().length > 180 ||
      sortOrder === null
    ) {
      setError('Enter a menu name and a non-negative whole-number sort order.');
      return null;
    }
    if (menu.description.trim().length > 1000) {
      setError('Menu descriptions can contain at most 1,000 characters.');
      return null;
    }
    return {
      name: menu.name.trim(),
      description: menu.description.trim() || null,
      sortOrder,
    };
  }

  async function saveMenu(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite || saving) return;
    const input = menuInput();
    if (!input) return;
    setSaving(true);
    setError(null);
    try {
      if (editingMenu) {
        await updateManagedRestaurantMenu(
          businessId,
          serviceId,
          editingMenu.id,
          input,
        );
      } else {
        await createManagedRestaurantMenu(businessId, serviceId, input);
      }
      setMenu(blankMenu());
      setEditingMenu(null);
      await load();
    } catch (reason) {
      setError(
        operationError(reason, 'The restaurant menu could not be saved.'),
      );
    } finally {
      setSaving(false);
    }
  }

  function menuItemInput(): RestaurantMenuItemInput | null {
    const sortOrder = nonNegativeInteger(item.sortOrder);
    const price = item.price.trim();
    const currency = item.currency.trim().toUpperCase();
    if (
      item.name.trim().length < 1 ||
      item.name.trim().length > 180 ||
      item.section.trim().length > 120 ||
      item.description.trim().length > 1000 ||
      !moneyPattern.test(price) ||
      !/^[A-Z]{3}$/.test(currency) ||
      sortOrder === null
    ) {
      setError(
        'Enter a menu-item name, valid non-negative decimal price, three-letter currency, and whole-number sort order.',
      );
      return null;
    }
    return {
      section: item.section.trim() || null,
      name: item.name.trim(),
      description: item.description.trim() || null,
      price,
      currency,
      sortOrder,
    };
  }

  async function saveMenuItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canWrite || saving || !editingItem) return;
    const input = menuItemInput();
    if (!input) return;
    setSaving(true);
    setError(null);
    try {
      if (editingItem.item) {
        await updateManagedRestaurantMenuItem(
          businessId,
          serviceId,
          editingItem.menuId,
          editingItem.item.id,
          input,
        );
      } else {
        await createManagedRestaurantMenuItem(
          businessId,
          serviceId,
          editingItem.menuId,
          input,
        );
      }
      setItem(blankItem());
      setEditingItem(null);
      await load();
    } catch (reason) {
      setError(operationError(reason, 'The menu item could not be saved.'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleMenu(current: ManagedRestaurantMenu) {
    if (!canWrite || saving) return;
    setSaving(true);
    setError(null);
    try {
      await restaurantMenuAction(
        businessId,
        serviceId,
        current.id,
        current.isActive ? 'deactivate' : 'activate',
      );
      await load();
    } catch (reason) {
      setError(operationError(reason, 'The menu state could not be changed.'));
    } finally {
      setSaving(false);
    }
  }

  async function toggleMenuItem(
    menuId: string,
    current: ManagedRestaurantMenuItem,
  ) {
    if (!canWrite || saving) return;
    setSaving(true);
    setError(null);
    try {
      await restaurantMenuItemAction(
        businessId,
        serviceId,
        menuId,
        current.id,
        current.available ? 'unavailable' : 'available',
      );
      await load();
    } catch (reason) {
      setError(
        operationError(
          reason,
          'The menu item availability could not be changed.',
        ),
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <p className="rounded-md bg-white p-5 text-sm text-slate-500">
        Loading restaurant details...
      </p>
    );
  }

  return (
    <main className="bg-slate-50">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <ServiceWorkspaceHeader
          businessId={businessId}
          serviceId={serviceId}
          serviceName={restaurant?.service.name ?? 'Restaurant Details'}
          serviceStatus={restaurant?.service.status ?? 'DRAFT'}
          categoryName={
            restaurant?.service.category.name ?? 'Restaurant Details'
          }
          categoryFamily="RESTAURANT"
          canWrite={canWrite}
          currentSection="category"
          description="Configure cuisine, menus, and menu items. Reservation and delivery settings remain descriptive capabilities."
        />
        {error ? (
          <p
            role="alert"
            className="mt-5 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"
          >
            {error}
          </p>
        ) : null}
        {restaurant ? (
          <>
            <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-bold text-slate-950">
                Restaurant details
              </h2>
              <form
                onSubmit={(event) => void saveDetail(event)}
                className="mt-4 grid gap-4 sm:grid-cols-2"
              >
                <label className="sm:col-span-2 text-sm font-semibold text-slate-700">
                  Cuisine types{' '}
                  <span className="font-normal">(comma separated)</span>
                  <input
                    disabled={!canWrite || saving}
                    maxLength={1619}
                    placeholder="Ethiopian, Wolaita, International"
                    value={detail.cuisineTypes}
                    onChange={(event) =>
                      setDetail((current) => ({
                        ...current,
                        cuisineTypes: event.target.value,
                      }))
                    }
                    className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5 disabled:bg-slate-100"
                  />
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    disabled={!canWrite || saving}
                    checked={detail.reservationSupported}
                    onChange={(event) =>
                      setDetail((current) => ({
                        ...current,
                        reservationSupported: event.target.checked,
                      }))
                    }
                  />
                  Reservation supported
                </label>
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    disabled={!canWrite || saving}
                    checked={detail.deliverySupported}
                    onChange={(event) =>
                      setDetail((current) => ({
                        ...current,
                        deliverySupported: event.target.checked,
                      }))
                    }
                  />
                  Delivery supported
                </label>
                {canWrite ? (
                  <div className="sm:col-span-2">
                    <button
                      disabled={saving}
                      className="rounded-md bg-highland px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
                    >
                      {saving ? 'Saving...' : 'Save restaurant details'}
                    </button>
                  </div>
                ) : null}
              </form>
            </section>

            {canWrite ? (
              <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-slate-950">
                    {editingMenu ? 'Edit menu' : 'Add menu'}
                  </h2>
                  {editingMenu ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingMenu(null);
                        setMenu(blankMenu());
                      }}
                      className="text-sm font-semibold text-slate-600"
                    >
                      Cancel edit
                    </button>
                  ) : null}
                </div>
                {!restaurant.detail ? (
                  <p className="mt-3 text-sm text-slate-600">
                    Save restaurant details first to add menus.
                  </p>
                ) : (
                  <form
                    onSubmit={(event) => void saveMenu(event)}
                    className="mt-4 grid gap-4 sm:grid-cols-2"
                  >
                    <label className="text-sm font-semibold text-slate-700">
                      Menu name
                      <input
                        required
                        disabled={saving}
                        maxLength={180}
                        value={menu.name}
                        onChange={(event) =>
                          setMenu((current) => ({
                            ...current,
                            name: event.target.value,
                          }))
                        }
                        className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5"
                      />
                    </label>
                    <label className="text-sm font-semibold text-slate-700">
                      Sort order
                      <input
                        required
                        disabled={saving}
                        inputMode="numeric"
                        value={menu.sortOrder}
                        onChange={(event) =>
                          setMenu((current) => ({
                            ...current,
                            sortOrder: event.target.value,
                          }))
                        }
                        className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5"
                      />
                    </label>
                    <label className="sm:col-span-2 text-sm font-semibold text-slate-700">
                      Description{' '}
                      <span className="font-normal">(optional)</span>
                      <textarea
                        disabled={saving}
                        maxLength={1000}
                        value={menu.description}
                        onChange={(event) =>
                          setMenu((current) => ({
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
                          ? 'Saving...'
                          : editingMenu
                            ? 'Save menu'
                            : 'Add menu'}
                      </button>
                    </div>
                  </form>
                )}
              </section>
            ) : null}

            {canWrite && editingItem ? (
              <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-bold text-slate-950">
                    {editingItem.item ? 'Edit menu item' : 'Add menu item'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingItem(null);
                      setItem(blankItem());
                    }}
                    className="text-sm font-semibold text-slate-600"
                  >
                    Cancel
                  </button>
                </div>
                <form
                  onSubmit={(event) => void saveMenuItem(event)}
                  className="mt-4 grid gap-4 sm:grid-cols-2"
                >
                  <label className="text-sm font-semibold text-slate-700">
                    Item name
                    <input
                      required
                      disabled={saving}
                      maxLength={180}
                      value={item.name}
                      onChange={(event) =>
                        setItem((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5"
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Section <span className="font-normal">(optional)</span>
                    <input
                      disabled={saving}
                      maxLength={120}
                      value={item.section}
                      onChange={(event) =>
                        setItem((current) => ({
                          ...current,
                          section: event.target.value,
                        }))
                      }
                      className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5"
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Price
                    <input
                      required
                      disabled={saving}
                      inputMode="decimal"
                      value={item.price}
                      onChange={(event) =>
                        setItem((current) => ({
                          ...current,
                          price: event.target.value,
                        }))
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
                      value={item.currency}
                      onChange={(event) =>
                        setItem((current) => ({
                          ...current,
                          currency: event.target.value.toUpperCase(),
                        }))
                      }
                      className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5"
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Sort order
                    <input
                      required
                      disabled={saving}
                      inputMode="numeric"
                      value={item.sortOrder}
                      onChange={(event) =>
                        setItem((current) => ({
                          ...current,
                          sortOrder: event.target.value,
                        }))
                      }
                      className="mt-1.5 w-full rounded-md border border-slate-300 p-2.5"
                    />
                  </label>
                  <label className="text-sm font-semibold text-slate-700">
                    Description <span className="font-normal">(optional)</span>
                    <input
                      disabled={saving}
                      maxLength={1000}
                      value={item.description}
                      onChange={(event) =>
                        setItem((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
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
                        : editingItem.item
                          ? 'Save menu item'
                          : 'Add menu item'}
                    </button>
                  </div>
                </form>
              </section>
            ) : null}

            <section className="mt-6">
              <h2 className="text-lg font-bold text-slate-950">Menus</h2>
              <div className="mt-3 space-y-3">
                {restaurant.menus.length ? (
                  restaurant.menus.map((currentMenu) => (
                    <article
                      key={currentMenu.id}
                      className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-slate-950">
                              {currentMenu.name}
                            </h3>
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-semibold ${currentMenu.isActive ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-100 text-slate-700'}`}
                            >
                              {currentMenu.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </div>
                          {currentMenu.description ? (
                            <p className="mt-1 text-sm text-slate-600">
                              {currentMenu.description}
                            </p>
                          ) : null}
                        </div>
                        {canWrite ? (
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => {
                                setEditingMenu(currentMenu);
                                setMenu(menuValues(currentMenu));
                              }}
                              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                            >
                              Edit menu
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => void toggleMenu(currentMenu)}
                              className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                            >
                              {currentMenu.isActive
                                ? 'Deactivate'
                                : 'Reactivate'}
                            </button>
                            <button
                              type="button"
                              disabled={saving}
                              onClick={() => {
                                setEditingItem({
                                  menuId: currentMenu.id,
                                  item: null,
                                });
                                setItem(blankItem());
                              }}
                              className="rounded-md border border-amber-200 px-3 py-2 text-sm font-semibold text-amber-800"
                            >
                              Add menu item
                            </button>
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
                        {currentMenu.items.length ? (
                          currentMenu.items.map((currentItem) => (
                            <div
                              key={currentItem.id}
                              className="flex flex-wrap items-start justify-between gap-3 rounded-md bg-slate-50 p-4"
                            >
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <h4 className="font-semibold text-slate-900">
                                    {currentItem.name}
                                  </h4>
                                  <span
                                    className={`rounded-full px-2 py-1 text-xs font-semibold ${currentItem.available ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-200 text-slate-700'}`}
                                  >
                                    {currentItem.available
                                      ? 'Available'
                                      : 'Unavailable'}
                                  </span>
                                </div>
                                <p className="mt-1 text-sm text-slate-600">
                                  {currentItem.section
                                    ? `${currentItem.section} · `
                                    : ''}
                                  {currentItem.currency} {currentItem.price}
                                </p>
                                {currentItem.description ? (
                                  <p className="mt-1 text-sm text-slate-600">
                                    {currentItem.description}
                                  </p>
                                ) : null}
                              </div>
                              {canWrite ? (
                                <div className="flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() => {
                                      setEditingItem({
                                        menuId: currentMenu.id,
                                        item: currentItem,
                                      });
                                      setItem(itemValues(currentItem));
                                    }}
                                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                                  >
                                    Edit item
                                  </button>
                                  <button
                                    type="button"
                                    disabled={saving}
                                    onClick={() =>
                                      void toggleMenuItem(
                                        currentMenu.id,
                                        currentItem,
                                      )
                                    }
                                    className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                                  >
                                    {currentItem.available
                                      ? 'Mark unavailable'
                                      : 'Mark available'}
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          ))
                        ) : (
                          <p className="text-sm text-slate-600">
                            No menu items have been added yet.
                          </p>
                        )}
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">
                    No menus have been added yet.
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
