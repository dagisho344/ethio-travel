# Tour Service Completion

## Scope

Phase 14D makes the existing `Service`, `TourDetail`, and
`TourItineraryItem` foundation operational. `Service` remains the aggregate
root for business ownership, lifecycle, generic pricing, media, reviews,
availability, and generic booking. Tour content is an optional extension; it
does not create a parallel tour booking, payment, review, or availability
system.

## Category compatibility and authorization

Tour management is available only when
`ServiceCategory.family === TOUR`. Database-managed category codes and display
names are not used to make this decision, so a future category with a
`TOUR` family works without code changes.

Routes are nested under:

`/api/v1/my/businesses/:businessId/services/:serviceId/tour`

The service verifies an active user, an active membership in the requested
business, ownership of the Service by that business, the `TOUR` family, and
the itinerary item's ownership through the TourDetail and Service chain.

- Active OWNER and MANAGER members may update details and create or edit
  itinerary items.
- Active STAFF members may read the scoped configuration only.
- Inactive users, inactive members, unrelated users, and cross-business
  service or itinerary UUIDs are denied server-side.

## Details and itinerary

Tour details may contain duration days (1?365), bounded difficulty and meeting
point labels, plus extensible inclusion and exclusion arrays. Arrays have at
most 30 non-empty, trimmed entries of at most 300 characters. Values are
deduplicated case-insensitively while retaining the first spelling.

Itinerary items contain a positive day number, title, optional description,
and non-negative sort order. They are deterministically ordered by day,
sort order, then creation time. The API uses upsert only on an authorized
detail update; GET never creates a TourDetail.

When duration is configured, new or updated itinerary days cannot exceed it.
A duration change cannot reduce the duration below the maximum persisted
itinerary day. No itinerary rows are deleted to resolve an inconsistent
update.

Tour details can retain at most
`MAX_TOUR_ITINERARY_ITEMS = 500` itinerary rows through normal application
writes. This is an application and response-size limit, not a database
cardinality constraint. Existing rows are never deleted or backfilled; all
historical rows count toward the create limit, and projections return the
first deterministic bounded result.

There is no itinerary DELETE route. Editing retains the same row and ID.

## Business Portal and BFF

A compatible Service shows a **Tour** link in the existing Services workspace.
The protected Tour page lets owners and managers save details and add or edit
itinerary items. Staff receive a read-only view. The existing Business Portal
shell is unchanged.

Next.js BFF routes use fixed backend paths, UUID validation, declared scalar
allowlists, explicit string-array fields (`inclusions`, `exclusions`), the
existing HttpOnly session forwarding, and same-origin mutation protection.
Unknown fields, objects, nested arrays, and string arrays in non-array fields
are rejected. No access or refresh token is exposed to browser storage.

## Public output

Tour data is returned only by the existing public Service projection. Existing
business, category, location, verification, service-status, and suspension
eligibility checks remain authoritative. An eligible `TOUR`-family Service
can include duration, difficulty, meeting point, inclusions, exclusions, and
a bounded safe itinerary of day, title, and description.

There is no public TourDetail endpoint. Draft, inactive, unverified, and
suspended parent services or businesses do not bypass central Service
eligibility.

## Boundaries and deferrals

Phase 14D does not add:

- `TourBooking`, `TourPayment`, or `TourAvailability`
- tour-departure scheduling
- seat or capacity allocation
- a new availability engine
- a new payment/refund flow
- itinerary deletion
- transport completion (Phase 14E)

Existing `ServiceAvailability`, `Booking`, `Payment`, refund, review,
media, and business-suspension rules remain authoritative. No Prisma schema
change or migration is required because Phase 14A already created the Tour
tables.

