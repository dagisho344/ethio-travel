# Restaurant Service Completion

## Scope

Phase 14C makes the existing `Service`, `RestaurantDetail`, `RestaurantMenu`,
and `RestaurantMenuItem` foundation operational. `Service` remains the common
aggregate root: it continues to own business membership, lifecycle, shared
price/currency semantics, media, reviews, availability, and generic booking
relationships.

Restaurant configuration is available only when
`ServiceCategory.family === RESTAURANT`. Individual category codes such as
`MEAL`, `RESTAURANT`, `CAFE`, or a future database-managed code are not used as
the compatibility discriminator. Display names are never used for this rule.

## Authorization and ownership

All management routes are nested under:

`/api/v1/my/businesses/:businessId/services/:serviceId/restaurant`

- Active `OWNER` and `MANAGER` members can create and update restaurant
  details, menus, and menu items, and use explicit lifecycle commands.
- Active `STAFF` members can read the same scoped configuration but cannot
  mutate it.
- The API validates an active user, active membership, business ownership of
  the Service, the `RESTAURANT` family, RestaurantDetail ownership, menu
  ownership, and menu-item ownership. A UUID alone never grants access.

## Restaurant detail and cuisines

Restaurant details contain an extensible trimmed cuisine array plus independent
`reservationSupported` and `deliverySupported` booleans. Cuisines are not an
enum; write validation bounds the array to 20 entries and each entry to 80
characters. The service deduplicates cuisines case-insensitively while
preserving the first entered label.

`reservationSupported` is descriptive capability only. It does not create a
table-reservation engine, table inventory, or restaurant-specific availability.
`deliverySupported` is also descriptive only; food ordering, cart, checkout,
delivery addresses, tracking, and fulfillment are outside Phase 14C.

## Menus and items

Menus and menu items use explicit, non-destructive lifecycles:

- Menus are created/updated and activated/deactivated; no normal delete route
  exists. Inactive menus are retained with their child items.
- Menu items are created/updated and marked available/unavailable; no normal
  delete route exists. Unavailable items are retained.
- Both use deterministic `sortOrder ASC, createdAt ASC` ordering.

Menu-item prices are validated decimal strings and stored as Prisma `Decimal`.
They are serialized as strings and never used in JavaScript floating-point
financial arithmetic. Currency is required and must be an uppercase three-letter
code. `Service.price` remains generic/from/service-level pricing; changing a
specific `RestaurantMenuItem.price` never rewrites it.

## Public projection

Restaurant content is exposed only through the existing public Service path and
therefore retains the central Service/business/category/location eligibility
checks. Eligible `RESTAURANT`-family services return:

- cuisine types
- reservation and delivery capability flags
- active menus
- available menu items with safe section, description, decimal price, and
  currency fields

Inactive menus and unavailable items are not public. Draft, inactive, archived,
unverified, or suspended parent Services/businesses remain excluded by the
existing public eligibility logic. There is no standalone public
RestaurantDetail endpoint.

## Business Portal and BFF

The existing Services workspace shows **Restaurant** only for
`RESTAURANT`-family services. The protected restaurant editor supports details,
menus, menu items, and explicit lifecycle actions. Staff receive a read-only
view.

Restaurant BFF routes use fixed backend paths, UUID validation, strict body
allowlists, existing HttpOnly-session forwarding, and same-origin mutation
protection. They do not expose access tokens, refresh tokens, or arbitrary
backend proxy paths.

## Boundaries and deferrals

Phase 14C does not add:

- `RestaurantBooking`
- `RestaurantAvailability`
- restaurant table inventory
- a food-ordering/cart/checkout system
- delivery fulfillment
- restaurant-specific payments or reviews

Existing `ServiceAvailability`, `Booking`, `Payment`, refund, review, and media
systems remain authoritative. No Prisma schema change or migration is required
for Phase 14C because Phase 14A already created the required tables.

## Tests

Coverage includes family compatibility, owner/manager/staff behavior,
non-member and cross-business denial, detail/menu/item validation, explicit
non-destructive lifecycle actions, Decimal/currency output, public active and
available filtering, BFF allowlists, and booking/payment non-interference.
## BFF array handling and response bounds

The Restaurant detail BFF has one explicit string-array field:
`cuisineTypes`. It accepts only arrays whose every value is a string, alongside
its scalar `reservationSupported` and `deliverySupported` fields. Unknown body
keys, objects, nested arrays, and array values for scalar fields are rejected
by the BFF. The Nest DTO remains authoritative for trimming, per-entry length,
array length, and other domain validation.

Restaurant catalogue responses use application-level limits:

- `MAX_RESTAURANT_MENUS = 20` per RestaurantDetail.
- `MAX_RESTAURANT_MENU_ITEMS = 100` per RestaurantMenu.

Create operations count all rows in their authorized parent scope. Inactive
menus and unavailable items still count, so lifecycle changes cannot bypass the
limits. Existing rows are never deleted or backfilled; if historical data is
above a limit, management and public projections return the deterministic first
bounded set and new creates are rejected. The limits are product/response-size
guards rather than database cardinality constraints, so concurrent creates are
not treated as a locking or inventory system.

Management and public projections use the same deterministic `take` bounds with
existing `sortOrder ASC, createdAt ASC` ordering. Public projection continues to
apply active-menu and available-item filters before the bounds.

The native web test setup statically verifies the TypeScript BFF source rather
than importing Next route helpers at runtime; API DTO and route tests remain the
runtime validation coverage.