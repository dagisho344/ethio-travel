# Transport Service Completion

## Scope

Phase 14E makes the existing `TransportDetail`, `TransportRoute`, and
`TransportSchedule` extension models operational. `Service` remains the
aggregate root for business ownership, lifecycle, generic/from-price data,
media, reviews, availability, and generic booking. Transport adds neither a
parallel booking, payment, review, media, nor availability aggregate.

## Compatibility and authorization

Transport configuration is available only when
`ServiceCategory.family === TRANSPORT`. Category display names and individual
database-managed codes, including `TRANSFER`, are not used as discriminators.
A future `BUS_TRANSFER` category is compatible when its family is
`TRANSPORT`.

Management routes are nested under:

`/api/v1/my/businesses/:businessId/services/:serviceId/transport`

The service confirms an active user, active membership in the requested
business, ownership of the Service by that business, the `TRANSPORT` family,
and scoped ownership from TransportDetail through Route and Schedule.

- Active OWNER and MANAGER members may update details, routes, and schedules.
- Active STAFF may read but cannot mutate.
- Inactive users, inactive members, unrelated users, and cross-business UUIDs
  are rejected server-side.

## Details, routes, and cities

Transport details contain optional, trimmed `mode` (40 characters) and
`operatorName` (180 characters). GET does not create a detail row; an
authorized PATCH may upsert it.

Routes contain origin and destination City IDs. The backend requires both
City rows to be active, using the existing business-location `LocationStatus`
policy, and rejects equal origin and destination IDs. The portal reuses the
existing public active City API; it does not ship a hard-coded city list.

There is no route DELETE route. Every TransportDetail can retain at most
`MAX_TRANSPORT_ROUTES = 100` rows through normal application creates. The
limit counts all retained rows and is an application-level product and
response-size guard, not a database cardinality constraint.

## Schedules, time, money, and capacity

Schedules store timezone-qualified ISO timestamps and are serialized as UTC
ISO timestamps. The portal uses `datetime-local` only as input presentation,
then converts the browser-local selection to `toISOString()` before sending
it. The API rejects timestamps without `Z` or an explicit offset, and
requires `arrivalAt > departureAt`.

`fare` is a Prisma `Decimal` and is accepted as a validated decimal string,
stored via `Prisma.Decimal`, and returned as a string. Currency is an explicit
uppercase three-letter code. No floating-point money calculation or currency
conversion is performed.

`capacity` is a positive integer catalog/configuration value. It is not
remaining-seat inventory and is not decremented by Booking.

Each Route can retain at most
`MAX_TRANSPORT_SCHEDULES_PER_ROUTE = 500` rows. Active and inactive schedules
both count. Deactivation and reactivation use explicit commands on the same
row and ID; no schedule DELETE or generic status PATCH exists.

## BFF and Business Portal

The protected workspace route is:

`/businesses/manage/:businessId/services/:serviceId/transport`

The Service card displays **Transport** only for the `TRANSPORT` family. The
portal keeps the existing Business Portal shell, uses owner/manager write
controls, and provides staff a read-only view.

Next.js BFF routes use fixed backend paths, UUID validation, strict allowlists
for detail (`mode`, `operatorName`), route (`originCityId`,
`destinationCityId`), and schedule (`departureAt`, `arrivalAt`, `fare`,
`currency`, `capacity`) bodies. They use HttpOnly session forwarding and the
existing same-origin guard for mutations. They expose no access or refresh
token, arbitrary backend URL, localStorage, or sessionStorage authentication.

## Public output and response bounds

Transport is returned only through the existing eligible public Service
projection. Central business status, verification, location, Service status,
and suspension rules remain authoritative. There is no standalone public
TransportDetail endpoint.

Eligible `TRANSPORT`-family services expose only mode, operator name, bounded
routes with safe City `id`/`name`/`slug`, and bounded active schedules with
departure, arrival, fare, currency, and capacity. Routes are ordered by
creation time; schedules by departure then creation time. Routes with no
active schedules remain visible with an empty schedule list. Past active
schedules are not silently filtered in this phase.

## Boundaries and deferrals

Phase 14E does not add:

- `TransportBooking`, `TransportPayment`, `TransportAvailability`, or
  `SeatBooking`
- Booking route/schedule binding or Booking schema changes
- seat inventory, capacity decrementing, passenger manifests, or reservation
  locks
- recurring schedules, route deletion/versioning, or schedule deletion/versioning
- payment, refund, webhook, or booking-state behavior
- Phase 14F, Phase 14G, Phase 14H, or Phase 15 work

Existing `ServiceAvailability`, `Booking`, `Payment`, reviews, media, and
business-suspension behavior remain authoritative. Phase 14E needs no Prisma
schema change or migration because the Phase 14A foundation already exists.
