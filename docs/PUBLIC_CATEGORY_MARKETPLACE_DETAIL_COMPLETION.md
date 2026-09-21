# Public Category Marketplace and Detail Completion

## Phase 14G scope

Phase 14G completes EthioTravel's public, category-aware browsing surface. It
adds explicit public category pages for Hotels, Restaurants, Tours, and
Transport, together with canonical public Service and Business details. It
does not create a second public domain for any category: `Service` remains the
aggregate root.

## Public routes

- `/hotels` maps explicitly to `ACCOMMODATION`.
- `/restaurants` maps explicitly to `RESTAURANT`.
- `/tours` maps explicitly to `TOUR`.
- `/transport` maps explicitly to `TRANSPORT`.
- `/services/:id` is the canonical eligible public Service detail route.
- `/regions/:regionSlug/cities/:citySlug/businesses/:businessSlug` is the canonical eligible public Business detail route. Business slugs are unique within a city, so the region and city scope is required.

The category-route mapping is a typed, fixed frontend resolver. It never uses
a Service category code, display name, or a dynamically generated route. A
future category such as `HOTEL_PREMIUM` works once its database-managed
`family` is `ACCOMMODATION`.

## Public API contract

The existing public Service API remains the only Service projection. Phase
14G adds allowlisted read capabilities to it:

- `GET /services?family=<ServiceCategoryFamily>` provides a bounded,
  paginated family browse query.
- `GET /services/:id` reads one otherwise eligible Service.
- `GET /regions/:regionSlug/cities/:citySlug/businesses/:businessSlug` reads one otherwise eligible Business.

Public Service output includes the safe technical category family and the safe business, city, and region slugs required for canonical detail links. It may include up to two existing READY/PUBLIC
Business hero/logo media references. These contain only a controlled public
media access path, media ID, alt text, and caption—never a storage key, signed
URL, private document, or creator information.

## Eligibility and privacy

All new reads reuse central public eligibility. A Service is public only when
it is published and its Business is active, verified, in active location and
category hierarchy, and not blocked by destination publication policy.
Suspended, draft, unverified, inactive, and otherwise ineligible parents do
not expose specialized child data.

Public pages return explicit traveler-safe fields only. They do not return
memberships, user/session data, private verification documents, audit/admin
data, booking records, payment metadata, storage keys, or private media.

## Category detail sections

The Service detail shows common Service information first, then at most one
family-specific section:

- Accommodation: star class, check-in/out, and active room catalogue. Room
  quantity is never returned or described as availability.
- Restaurant: cuisine capabilities, active menus, and available menu items.
- Tour: duration, difficulty, meeting point, inclusions/exclusions, and the
  bounded itinerary.
- Transport: mode, operator, routes, and active schedules. Schedule capacity
  is labelled as configured capacity, never as remaining seats. Times render
  as UTC because no traveler timezone preference is inferred.
- `OTHER` or an unknown runtime family receives generic Service detail only.

The existing Phase 14B–14E `take` bounds are preserved for rooms, restaurant
menus/items, tour itinerary items, and transport routes/schedules. Category
landing pages use the existing paginated Service query (`limit: 12`), so they
do not perform a list request plus one specialized request per card.

## Money, booking, and availability boundaries

`Service.price` remains generic/from-price information. `RoomType.basePrice`,
`RestaurantMenuItem.price`, and `TransportSchedule.fare` remain independent
Decimal catalogue prices and are rendered as their original decimal string and
explicit currency; Phase 14G performs no currency conversion or floating-point
financial arithmetic.

The existing `BookingWidget`, Service availability checks, reviews, favorites,
and messaging/contact flow are reused. This phase does not add hotel-room,
restaurant-table, tour-seat, or transport-seat inventory. It does not add a
category-specific booking, payment, refund, availability, cart, delivery, or
schedule engine.

## Deferrals

Phase 14H owns advanced category filtering and regression hardening. Phase 15
owns maps, Near Me, geolocation, distance ranking, and route visualization.
No Phase 14G work changes Prisma schema, migrations, booking/payment state,
or provider/webhook authority.
