# Trip Planner (Phase 10)

## Purpose

Trip Planner is a private, authenticated traveler workspace for organizing an itinerary. It reuses canonical locations, destinations, attractions, businesses, services, and bookings; it does not copy or invent marketplace data. A trip is not a booking, payment record, or a new messaging channel.

## Data model

- `Trip` is owned by one `User`, has calendar-date `startDate`/`endDate`, optional origin/destination context, notes, a persisted planning status, and an archival timestamp.
- `TripDay` is generated deterministically for every date in a trip. `(tripId, date)` and `(tripId, dayNumber)` are unique.
- `TripItem` belongs to one day and has an ordered `position`. Its type is one of `DESTINATION`, `ATTRACTION`, `BUSINESS`, `SERVICE`, `BOOKING`, or `CUSTOM`.
- Database check constraints require exactly the matching canonical foreign key for each non-custom item. A custom item has no system target and requires its own title.
- All foreign keys are restrictive. Removing a trip item never removes the referenced booking, payment, service, business, attraction, or destination. Trips are archived rather than hard-deleted in Phase 10.

## Ownership and visibility

Every Trip Planner endpoint derives the traveler from the authenticated JWT. There is no browser-supplied `userId` and no cross-user sharing. Owned-trip and owned-day queries include the current user in their server-side predicate; a guessed foreign UUID is returned as not found.

Adding a new destination, attraction, business, or service checks the existing public-eligibility predicate at the API boundary. Adding a booking checks `booking.travelerId` against the current traveler. An advisory transaction lock plus a same-trip lookup prevents attaching the same booking more than once to a trip.

Existing trip items retain their snapshots and canonical references for historical readability if a marketplace item later becomes non-public. Visibility is only enforced for *new* additions. Archived trips retain all history and are read-only.

## Dates, times, and status

Trip dates are date-only `YYYY-MM-DD` values. The API parses them as UTC midnight and serializes the date part, while the web form keeps native date-input strings. This avoids browser timezone shifts around calendar boundaries. Trip length is limited to 90 days.

Optional itinerary times are plain `HH:mm` wall-clock planning times, not instants. They must be valid 24-hour values and an end time must be later than a start time.

`DRAFT` and `UPCOMING` are persisted planning choices. The displayed status is deterministic:

- `ARCHIVED` when manually archived;
- `DRAFT` while still draft;
- `UPCOMING` before the start date;
- `IN_PROGRESS` from start through end date;
- `COMPLETED` after the end date.

Archived trips are immutable. Other trips remain editable so travelers can retain or refine historical planning notes; booking/payment state is always read-only itinerary context.

Changing dates preserves days and items whose calendar dates remain in range. Empty removed days are deleted. If a removed date contains itinerary items, the change is rejected until the traveler moves or removes those items. Preserved day-number changes use a two-phase temporary numbering transaction so uniqueness cannot collide during shifts.

## REST API

All routes require bearer authentication and Swagger documents them under `trips`.

- `POST /api/v1/trips` creates a trip and its days.
- `GET /api/v1/users/me/trips` lists only the caller's trips (`page`, `limit`, `status`, `timing`, `sort`).
- `GET /api/v1/trips/:id` returns an owned trip with chronological days, ordered items, booking context, and a safe same-currency booking estimate.
- `PATCH /api/v1/trips/:id` updates trip details and safely reconciles date changes.
- `POST /api/v1/trips/:id/archive` archives without deleting history.
- `GET /api/v1/trips/:id/days` retrieves chronological days.
- `PATCH /api/v1/trips/:id/days/:dayId` updates a day note.
- `POST /api/v1/trips/:id/days/:dayId/items` adds one valid item.
- `PATCH /api/v1/trips/:id/days/:dayId/items/:itemId` edits compatible item data.
- `DELETE /api/v1/trips/:id/days/:dayId/items/:itemId` removes only an itinerary association.
- `POST /api/v1/trips/:id/days/:dayId/items/reorder` accepts every current item ID exactly once and reorders transactionally.

Estimated booking cost is returned only from authoritative booking subtotals. It is summed only when every associated booking has the same known currency; no foreign-exchange conversion is fabricated.

## Web BFF and UI

The Next.js BFF retains the existing HttpOnly `et_access` / `et_refresh` architecture. Browser code calls same-origin routes only:

- `/api/trips`
- `/api/trips/:id`
- `/api/trips/:id/archive`
- `/api/trips/:id/days/:dayId`
- `/api/trips/:id/days/:dayId/items`
- `/api/trips/:id/days/:dayId/items/:itemId`
- `/api/trips/:id/days/:dayId/items/reorder`

The BFF forwards authenticated requests server-side, refreshes cookies through the existing helper, clears cookies on a 401, and calls `validateSameOrigin` for every mutation. Access and refresh tokens are never exposed to JavaScript or browser storage.

Authenticated frontend routes are:

- `/trips` — responsive private trip list, status filter, empty/error/loading states;
- `/trips/new` — title, optional origin, cascading region/city/destination selection, calendar dates, and notes;
- `/trips/:id` — responsive day timeline, notes, real public search, owned-booking selection, item removal/edit notes, accessible up/down controls, and non-destructive archiving.

The add-item flow searches only the existing public Search API for marketplace item types and reads owned bookings through the protected BFF. The detail view uses server-persisted responses as authoritative after every mutation.

## Known limitations and future integration

Phase 10 deliberately adds no trip-specific chat, email/SMS/push, scheduled reminders, background jobs, or AI recommendations. Existing booking and business message flows remain the appropriate contact paths. A future Phase 11 integration may suggest real places or itinerary arrangements, but must still use these ownership, public-eligibility, date, and booking constraints.
