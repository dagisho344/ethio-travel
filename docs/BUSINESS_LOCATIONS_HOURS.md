# Business locations and operating hours (Phase 12B)

## Model and compatibility

`BusinessLocation` is the canonical branch record for business-management changes. A location belongs to one business, one active city, and optionally a published destination in that city. It retains its address, coordinates, IANA timezone, lifecycle status, and its own weekly schedule. `BusinessLocationOperatingHour` stores one recurring local-time interval for each weekday; a missing row is represented as closed in API responses.

The existing `Business.cityId`, destination, address, and coordinate fields remain during Phase 12B for compatibility with public business discovery, map output, bookings, trips, and AI grounding. The active primary `BusinessLocation` is synchronized to those legacy fields in the same transaction when it is made primary or edited. Existing owner/admin business-profile edits similarly synchronize the primary location. The legacy fields can only be removed after every public consumer has migrated to `primaryLocation` in a future compatibility-removal phase.

## Invariants and lifecycle

The additive migration `20260911000001_business_locations_hours` backfills one `Primary location` for every existing business. A partial unique index permits one non-archived primary record per business, and a database check requires a primary location to be active and unarchived. Service logic changes primary branches transactionally: it demotes the former primary, promotes the selected active branch, and then syncs legacy fields. A primary branch cannot be inactivated or archived; select another active branch first. A non-primary branch is archived rather than deleted. Archived branches and their hours are read-only.

Seeded `Addis Demo Guest House` is upserted with a single primary branch without creating duplicate location rows. The seed first demotes only another primary branch for that demo business, preserving the partial unique invariant.

## Authorization and REST API

All routes require the existing JWT authentication guard and independently validate active membership for the exact business:

- `GET /api/v1/my/businesses/:businessId/locations` and `GET .../:locationId`: `OWNER`, `MANAGER`, or `STAFF`.
- `POST /api/v1/my/businesses/:businessId/locations`, `PATCH .../:locationId`, `POST .../:locationId/make-primary`, `POST .../:locationId/archive`: `OWNER` or `MANAGER` only.
- `GET .../:locationId/hours`: all active roles; `PUT .../:locationId/hours`: `OWNER` or `MANAGER` only.

Inactive members and unrelated users are rejected by server-side membership checks. A client cannot choose an owner, role, or business identity outside its URL; the backend remains authoritative.

Locations validate active city, published destination/city relationship, coordinate ranges, bounded text, and an IANA timezone. A weekly schedule must contain each weekday once. Closed days have no times; open days use local `HH:mm` values where opening precedes closing. Split shifts and special/holiday exceptions are deliberately deferred.

## Open-now foundation

`BusinessLocationHoursService` interprets weekday and time in the location IANA timezone with `Intl.DateTimeFormat`. Recurring wall-clock hours are never converted to UTC for storage. It returns false for a closed/missing day or invalid timezone. Phase 12B does not add an Open Now filter, Near Me, distance ranking, or branch-level public search; those remain Discovery Completion work.

## Frontend and BFF

The protected workspace location page is `/businesses/manage/:businessId/locations`. Owner/manager users can add, edit, set primary, archive eligible branches, and replace weekly hours. Staff receive the same readable branch information but no write controls. The forms use real `Region -> City -> Destination` endpoints; changing region clears city/destination, and changing city clears the destination. The weekly editor stacks safely on small screens.

The same-origin BFF routes are:

- `/api/businesses/manage/:businessId/locations`
- `/api/businesses/manage/:businessId/locations/:locationId`
- `/api/businesses/manage/:businessId/locations/:locationId/make-primary`
- `/api/businesses/manage/:businessId/locations/:locationId/archive`
- `/api/businesses/manage/:businessId/locations/:locationId/hours`

They use the existing HttpOnly session helpers. Mutations validate same origin, forward only an allowlisted location/hours payload, and never expose access or refresh tokens to browser JavaScript.

## Public behavior and limitations

Public business search and maps still use legacy primary-compatible fields, so a business appears once rather than once per branch. Existing booking, Trip Planner, and AI business references continue pointing to the business, not a fabricated branch record. Business publication still requires the existing active, verified, eligible business predicates; location management never verifies or publishes a business.

Phase 12B intentionally does not add media or verification-document upload (Phase 12C), operating-hour split periods/special dates, public branch pages, or advanced discovery filters.