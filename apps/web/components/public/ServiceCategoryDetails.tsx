import {
  BedDouble,
  BusFront,
  CalendarDays,
  UtensilsCrossed,
} from 'lucide-react';
import type { Service } from '../../lib/types';

function CataloguePrice({
  price,
  currency,
}: {
  price: string;
  currency: string;
}) {
  return (
    <span className="font-semibold text-slate-950">
      {currency} {price}
    </span>
  );
}

function DetailList({ items, title }: { items: string[]; title: string }) {
  if (!items.length) return null;
  return (
    <section>
      <h4 className="text-sm font-bold text-slate-950">{title}</h4>
      <ul className="mt-2 grid gap-2 text-sm text-slate-700 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item} className="rounded-md bg-slate-50 px-3 py-2">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function AccommodationPublicDetails({ service }: { service: Service }) {
  const accommodation = service.accommodation;
  if (!accommodation) return null;
  return (
    <section
      aria-labelledby="accommodation-details"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <BedDouble className="h-5 w-5 text-highland" aria-hidden="true" />
        <h2
          id="accommodation-details"
          className="text-xl font-bold text-slate-950"
        >
          Accommodation details
        </h2>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-lg bg-slate-50 p-3">
          <dt className="text-slate-500">Property rating</dt>
          <dd className="mt-1 font-semibold text-slate-950">
            {accommodation.starClass
              ? `${accommodation.starClass} star${accommodation.starClass === 1 ? '' : 's'}`
              : 'Not listed'}
          </dd>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <dt className="text-slate-500">Check-in</dt>
          <dd className="mt-1 font-semibold text-slate-950">
            {accommodation.checkInTime ?? 'Contact business'}
          </dd>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <dt className="text-slate-500">Check-out</dt>
          <dd className="mt-1 font-semibold text-slate-950">
            {accommodation.checkOutTime ?? 'Contact business'}
          </dd>
        </div>
      </dl>
      <div className="mt-6">
        <h3 className="text-base font-bold text-slate-950">Room types</h3>
        {accommodation.roomTypes.length ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {accommodation.roomTypes.map((room) => (
              <article
                key={`${room.name}:${room.currency}:${room.basePrice}`}
                className="rounded-lg border border-slate-200 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <h4 className="font-semibold text-slate-950">{room.name}</h4>
                  <CataloguePrice
                    price={room.basePrice}
                    currency={room.currency}
                  />
                </div>
                {room.description ? (
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {room.description}
                  </p>
                ) : null}
                <p className="mt-3 text-sm text-slate-600">
                  Sleeps up to {room.capacity}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Room details are not listed yet. Contact the business for options.
          </p>
        )}
      </div>
    </section>
  );
}

export function RestaurantPublicDetails({ service }: { service: Service }) {
  const restaurant = service.restaurant;
  if (!restaurant) return null;
  return (
    <section
      aria-labelledby="restaurant-details"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <UtensilsCrossed className="h-5 w-5 text-highland" aria-hidden="true" />
        <h2
          id="restaurant-details"
          className="text-xl font-bold text-slate-950"
        >
          Restaurant details
        </h2>
      </div>
      {restaurant.cuisineTypes.length ? (
        <p className="mt-4 text-sm text-slate-700">
          <span className="font-semibold text-slate-950">Cuisine:</span>{' '}
          {restaurant.cuisineTypes.join(', ')}
        </p>
      ) : null}
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-lg bg-slate-50 p-3">
          <dt className="text-slate-500">Reservations</dt>
          <dd className="mt-1 font-semibold text-slate-950">
            {restaurant.reservationSupported
              ? 'Supported — contact the business'
              : 'Not listed'}
          </dd>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <dt className="text-slate-500">Delivery</dt>
          <dd className="mt-1 font-semibold text-slate-950">
            {restaurant.deliverySupported
              ? 'Supported — contact the business'
              : 'Not listed'}
          </dd>
        </div>
      </dl>
      <div className="mt-6">
        <h3 className="text-base font-bold text-slate-950">Menus</h3>
        {restaurant.menus.length ? (
          <div className="mt-3 space-y-4">
            {restaurant.menus.map((menu) => (
              <article
                key={menu.name}
                className="rounded-lg border border-slate-200 p-4"
              >
                <h4 className="font-semibold text-slate-950">{menu.name}</h4>
                {menu.description ? (
                  <p className="mt-1 text-sm text-slate-600">
                    {menu.description}
                  </p>
                ) : null}
                {menu.items.length ? (
                  <ul className="mt-4 divide-y divide-slate-100">
                    {menu.items.map((item) => (
                      <li
                        key={`${item.section ?? ''}:${item.name}:${item.currency}:${item.price}`}
                        className="flex items-start justify-between gap-4 py-3 first:pt-0 last:pb-0"
                      >
                        <div>
                          {item.section ? (
                            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                              {item.section}
                            </p>
                          ) : null}
                          <p className="font-medium text-slate-950">
                            {item.name}
                          </p>
                          {item.description ? (
                            <p className="mt-1 text-sm text-slate-600">
                              {item.description}
                            </p>
                          ) : null}
                        </div>
                        <CataloguePrice
                          price={item.price}
                          currency={item.currency}
                        />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-slate-600">
                    No available items are listed for this menu.
                  </p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
            No public menu is listed yet. Contact the business for current
            options.
          </p>
        )}
      </div>
    </section>
  );
}

export function TourPublicDetails({ service }: { service: Service }) {
  const tour = service.tour;
  if (!tour) return null;
  return (
    <section
      aria-labelledby="tour-details"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <CalendarDays className="h-5 w-5 text-highland" aria-hidden="true" />
        <h2 id="tour-details" className="text-xl font-bold text-slate-950">
          Tour details
        </h2>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
        <div className="rounded-lg bg-slate-50 p-3">
          <dt className="text-slate-500">Duration</dt>
          <dd className="mt-1 font-semibold text-slate-950">
            {tour.durationDays
              ? `${tour.durationDays} day${tour.durationDays === 1 ? '' : 's'}`
              : 'Contact business'}
          </dd>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <dt className="text-slate-500">Difficulty</dt>
          <dd className="mt-1 font-semibold text-slate-950">
            {tour.difficulty ?? 'Not listed'}
          </dd>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <dt className="text-slate-500">Meeting point</dt>
          <dd className="mt-1 font-semibold text-slate-950">
            {tour.meetingPoint ?? 'Contact business'}
          </dd>
        </div>
      </dl>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <DetailList title="Included" items={tour.inclusions} />
        <DetailList title="Not included" items={tour.exclusions} />
      </div>
      <div className="mt-6">
        <h3 className="text-base font-bold text-slate-950">Itinerary</h3>
        {tour.itinerary.length ? (
          <ol className="mt-3 space-y-3">
            {tour.itinerary.map((item) => (
              <li
                key={`${item.dayNumber}:${item.title}`}
                className="rounded-lg border border-slate-200 p-4"
              >
                <p className="text-xs font-semibold uppercase tracking-wide text-highland">
                  Day {item.dayNumber}
                </p>
                <h4 className="mt-1 font-semibold text-slate-950">
                  {item.title}
                </h4>
                {item.description ? (
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {item.description}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-3 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
            An itinerary is not listed yet. Contact the business for details.
          </p>
        )}
      </div>
    </section>
  );
}

function utcDateTime(value: string): string {
  return new Intl.DateTimeFormat('en', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC',
  }).format(new Date(value));
}

export function TransportPublicDetails({ service }: { service: Service }) {
  const transport = service.transport;
  if (!transport) return null;
  return (
    <section
      aria-labelledby="transport-details"
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-center gap-2">
        <BusFront className="h-5 w-5 text-highland" aria-hidden="true" />
        <h2 id="transport-details" className="text-xl font-bold text-slate-950">
          Transport details
        </h2>
      </div>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div className="rounded-lg bg-slate-50 p-3">
          <dt className="text-slate-500">Mode</dt>
          <dd className="mt-1 font-semibold text-slate-950">
            {transport.mode ?? 'Not listed'}
          </dd>
        </div>
        <div className="rounded-lg bg-slate-50 p-3">
          <dt className="text-slate-500">Operator</dt>
          <dd className="mt-1 font-semibold text-slate-950">
            {transport.operatorName ?? 'Not listed'}
          </dd>
        </div>
      </dl>
      <div className="mt-6">
        <h3 className="text-base font-bold text-slate-950">
          Routes and schedules
        </h3>
        {transport.routes.length ? (
          <div className="mt-3 space-y-4">
            {transport.routes.map((route) => (
              <article
                key={`${route.originCity.id}:${route.destinationCity.id}`}
                className="rounded-lg border border-slate-200 p-4"
              >
                <h4 className="font-semibold text-slate-950">
                  {route.originCity.name} to {route.destinationCity.name}
                </h4>
                {route.schedules.length ? (
                  <ul className="mt-3 divide-y divide-slate-100">
                    {route.schedules.map((schedule) => (
                      <li
                        key={`${schedule.departureAt}:${schedule.arrivalAt}:${schedule.fare}`}
                        className="grid gap-2 py-3 first:pt-0 last:pb-0 text-sm sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                      >
                        <p>
                          <span className="block text-xs text-slate-500">
                            Departure (UTC)
                          </span>
                          <span className="font-medium text-slate-950">
                            {utcDateTime(schedule.departureAt)}
                          </span>
                        </p>
                        <p>
                          <span className="block text-xs text-slate-500">
                            Arrival (UTC)
                          </span>
                          <span className="font-medium text-slate-950">
                            {utcDateTime(schedule.arrivalAt)}
                          </span>
                        </p>
                        <p className="sm:text-right">
                          <CataloguePrice
                            price={schedule.fare}
                            currency={schedule.currency}
                          />
                          <span className="mt-1 block text-xs text-slate-500">
                            Configured capacity: {schedule.capacity}
                          </span>
                        </p>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-3 text-sm text-slate-600">
                    No active schedules are listed for this route.
                  </p>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-3 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-600">
            No public routes are listed yet. Contact the business for travel
            options.
          </p>
        )}
      </div>
    </section>
  );
}

export function ServiceCategoryDetails({ service }: { service: Service }) {
  switch (service.category?.family) {
    case 'ACCOMMODATION':
      return <AccommodationPublicDetails service={service} />;
    case 'RESTAURANT':
      return <RestaurantPublicDetails service={service} />;
    case 'TOUR':
      return <TourPublicDetails service={service} />;
    case 'TRANSPORT':
      return <TransportPublicDetails service={service} />;
    default:
      return null;
  }
}
