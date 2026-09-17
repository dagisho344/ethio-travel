# Accommodation / Hotel Service Completion

## Scope

Phase 14B makes the existing `Service`, `AccommodationDetail`, and `RoomType`
models operational for accommodation services. It does not introduce a hotel
booking model, a separate payment model, room-reservation allocation, or
category-specific availability tables.

The stable technical `ServiceCategory.family` value `ACCOMMODATION` is the
accommodation compatibility key. `ROOM` is the current canonical seeded
accommodation category, while future categories such as `HOTEL`, `RESORT`, or
`GUEST_HOUSE` can share the same family. The API checks the family on the
service loaded within the authorized business scope. Category display names and
browser-provided category IDs are not used to establish compatibility.

## API and authorization

All routes are nested beneath:

`/api/v1/my/businesses/:businessId/services/:serviceId/accommodation`

- `GET /` and `GET /rooms` permit active `OWNER`, `MANAGER`, and `STAFF`
  members.
- `PATCH /`, `POST /rooms`, `PATCH /rooms/:roomTypeId`, and the explicit
  `activate`/`deactivate` room commands permit active `OWNER` and `MANAGER`
  members only.
- Every route validates UUID path parameters, checks the active user, checks
  active membership, scopes the service to the business, checks the
  `ACCOMMODATION` family, and scopes a room through its accommodation detail to
  that exact service.
- Inactive members, unrelated users, cross-business service IDs, and
  cross-service room IDs are denied without exposing a mutable path.

There are no `DELETE` endpoints. Deactivating a room type preserves its
historical record. Archived services cannot have accommodation configuration or
room types changed.

## Validation

Write DTOs and the business UI validate the following application rules:

- `starClass`: integer from 1 through 5 when supplied.
- `checkInTime` and `checkOutTime`: exact 24-hour `HH:mm` strings.
- Room name: trimmed, non-empty, at most 180 characters.
- Room description: optional and at most 1,000 characters.
- Capacity: whole number greater than zero.
- Quantity: whole number zero or greater.
- Base price: a non-negative decimal string with at most two fraction digits.
- Currency: uppercase three-letter code.

`basePrice` is converted to Prisma `Decimal` server-side; it is not used to
derive booking or payment totals. The room `quantity` is catalogue information
only in this phase. Existing service availability and transactional booking
capacity checks remain authoritative.

## Business workspace and BFF

Compatible services show an **Accommodation** link from the existing Services
workspace. The configuration page provides property details and room-type
create, edit, activate, and deactivate controls for owners/managers. Staff see
the same configuration data without write controls.

The Next.js BFF uses fixed backend paths, UUID checks, an allowlisted and
strictly rejected mutation body, and the existing HttpOnly-session forwarding
and same-origin protection. It never forwards browser access or refresh tokens
to client code.

## Public output

The existing public service APIs continue to apply their central published
service/business/category/location eligibility checks. For an eligible
`ACCOMMODATION`-family service with an accommodation detail, the response
additionally contains the star class, check-in/check-out times, and active room
catalogue fields:
name, description, capacity, base price, and currency.

Inactive rooms and internal `quantity` are not emitted publicly. The
projection neither changes public eligibility nor exposes accommodation data
for a non-`ACCOMMODATION`-family service, even if inconsistent data were
introduced outside these write APIs.

## Schema and migration

Phase 14B adds `ServiceCategoryFamily` and `ServiceCategory.family` through
the additive `20260916000002_service_category_family` migration. Existing
category IDs and Service-to-category assignments remain unchanged. `ROOM`,
`MEAL`, `TOUR`, and `TRANSFER` receive their unambiguous technical families;
ambiguous categories remain `OTHER`.

## Deliberate deferrals

Phase 14B does not allocate inventory during booking, create room-level
reservations, add hotel-specific payments, alter refund behavior, change the
existing availability domain, add a separate public accommodation detail page,
or add media uploads. Those extensions require later product phases and must
continue to preserve the shared service, booking, payment, review, and media
foundations.
