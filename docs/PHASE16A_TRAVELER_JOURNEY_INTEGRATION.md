# Phase 16A: Traveler Discovery-to-Action Integration

## Baseline

Phase 16A builds on the committed Phase 15 discovery and map experience. It
does not change the Prisma schema, migrations, seed data, Booking, Payment,
Refund, or ServiceAvailability state machines.

The canonical public routes remain:

- `/search` and `/search?view=map`;
- `/services/[id]`;
- `/regions/[regionSlug]/cities/[citySlug]/businesses/[businessSlug]`;
- `/regions/[regionSlug]/cities/[citySlug]/destinations/[destinationSlug]`.

## Traveler actions

Public Search cards, marketplace cards, and public detail pages now reuse the
existing action modules where their target type supports them:

- **View details** preserves the existing canonical Service or scoped-slug
  Business/Destination links. Map markers remain deliberately lightweight and
  route to those canonical detail pages.
- **Favorite** uses the existing `FavoriteButton` and Favorites BFF.
- **Add to trip** uses `AddToTripButton`, which loads only the signed-in
  traveler's paginated trips, asks for an active trip and a trip day, and posts
  the canonical target ID through the existing Trip Planner BFF.
- **Message business** reuses `StartConversationButton` for public businesses
  and services with a public business summary.
- **Book** reuses `BookingWidget` for services. It continues to call existing
  availability and booking endpoints; services without a valid bookable window
  receive the existing server-authoritative availability response.

No new booking, payment, conversation, favorite, trip, capacity, or pricing
domain has been introduced.

## Authorization and security

The browser never supplies a traveler identity, business membership, or final
eligibility decision.

- Guest protected actions preserve a relative, same-site `returnTo` and route
  to the existing login flow after a `401`.
- The Trip Planner BFF uses HttpOnly session forwarding and same-origin checks
  for the add-item mutation. The API still verifies active user status,
  ownership of the selected trip/day, archived-trip immutability, and public
  eligibility of a newly added marketplace target.
- Favorites retain target eligibility and authenticated-user ownership checks.
- Messaging retains public-business creation, active-conversation membership,
  and business membership checks in the existing API.
- Booking retains authoritative service eligibility, business-suspension,
  availability/capacity, booking lifecycle, and payment rules.
- Access and refresh tokens, device coordinates, private verification data,
  audit records, payment information, and membership data are not added to
  browser state or public projections.

## Interaction behavior

The Add to Trip dialog has loading, empty, retry, error, selected-trip/day,
success, Escape-close, focus-return, pagination, disabled-submit, and stale
trip-detail response handling. Archived trips are omitted from selection;
server-side checks remain authoritative if a trip changes while the dialog is
open. The dialog never creates a trip automatically.

Search and Map retain Phase 15's filter allowlists, Near Me ephemeral location
handling, marker clustering, bounded results, and stale-response protection.

## Reused APIs

- `GET /api/v1/search` and `GET /api/v1/map/places`
- Favorites BFF routes below `/api/favorites`
- Trip BFF routes below `/api/trips`, especially
  `POST /api/trips/:tripId/days/:dayId/items`
- Conversation BFF routes below `/api/conversations`
- `GET /api/services/:serviceId/availability` and `POST /api/bookings`

## Tests

Phase 16A adds focused web regression coverage for canonical public links,
supported action wiring, guest login handoff, trip/day selection, archived-trip
exclusion, BFF same-origin protection, stale request guards, duplicate-submit
protection, and reuse of existing Favorites, Messaging, Booking, and Trip
Planner safeguards. Existing API tests remain the source of truth for public
eligibility, favorite ownership, conversation authorization, trip ownership,
archived trips, and booking availability behavior.

## Known limitations and deferrals

- Map popups intentionally provide a canonical View Details action rather than
  mounting all interactive forms inside up to 500 clustered markers.
- The Trip Planner does not create trips automatically from a public card.
- Phase 16A does not add cross-trip sharing, new itinerary target types,
  booking/cart flows, price conversion, payments, capacity engines, or new
  notifications.
- Browser/manual checks remain necessary for responsive dialog interaction and
  authenticated action handoffs when a full browser runtime is unavailable.

Phase 16B, 16C, 16D, Phase 17, and any new marketplace/domain architecture are
out of scope.
