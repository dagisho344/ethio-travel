# API Specification
Base: `/api/v1`

## Auth
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
POST /auth/forgot-password
GET/PATCH /users/me

## Destinations
GET /regions
GET /cities
GET /destinations
GET /regions/:regionSlug/cities/:citySlug/destinations/:destinationSlug
GET /regions/:regionSlug/cities/:citySlug/destinations

## Region editorial translations — G1A

GET /regions?locale=en|am
GET /regions/:regionSlug?locale=en|am

Omitted locale and `en` use canonical Region fields. `am` uses a published
Amharic display name only when the translation is complete: a nonempty display
name, plus a nonempty translated description when the canonical description
is nonempty. Otherwise the entire canonical Region representation is returned.
An approved optional translated description may be shown when source prose is
absent. Explicit invalid/empty locale values return 400. Only ACTIVE Regions
are public; matching and ordering remain canonical. IDs/slugs are unchanged;
translation records and lifecycle fields are never serialized publicly.

GET /admin/regions/:id/translations/:locale
PUT /admin/regions/:id/translations/:locale
POST /admin/regions/:id/translations/:locale/publish
POST /admin/regions/:id/translations/:locale/unpublish

These endpoints require JWT authentication and ADMIN. Managed locale is `am`
only; English stays on Region. PUT accepts only nullable `displayName` (160)
and `description` (5,000), trims whitespace, and saves an unpublished draft.
Lifecycle POST bodies contain no fields. Publish revalidates completeness;
unpublish retains text and clears `publishedAt`. ARCHIVED Regions permit read
and unpublish only. Actual canonical name/description edits automatically
unpublish published translations transactionally; identical or unrelated
updates do not. Translation mutations/invalidation are audited without prose.

G1A creates migration `20260929000001_region_translations` for review only.
**It is not applied.** Deployment and database-backed verification require
separate G1B approval. No web editor/BFF/forwarding or Search/Map translation
matching is added. See [Region architecture](I18N_EDITORIAL_REGIONS.md).

## Search
GET /search
GET /map/places

Both public discovery routes accept optional `locale=en|am` (invalid explicit values return 400). Omitted or `en` keeps canonical Destination matching and presentation. With `am`, Destination matching includes canonical fields plus complete, published Amharic `displayName` and `shortDescription`; translated `fullDescription` is required for completeness but is not searched. Destination names/snippets and map labels use the F1-resolved public fields. Attraction, Business, and Service matching is unchanged. The `/search` web server resolves `et_locale` and its client forwards only the validated locale to these public API routes; locale is not a browser URL parameter.

## Businesses
POST /businesses
GET /api/v1/regions/:regionSlug/cities/:citySlug/businesses/:businessSlug
PATCH /businesses/:id
POST /businesses/:id/media
GET/POST /businesses/:id/services
POST /businesses/:id/submit-verification

## Services
GET/PATCH /services/:id
GET /services/:id/availability

## Favorites/Reviews
GET /favorites
POST/DELETE /favorites/:type/:id
POST /reviews
GET /businesses/:id/reviews

## Booking/Payment
POST/GET /bookings
GET /bookings/:id
POST /bookings/:id/cancel
POST /payments/intents
POST /payments/webhooks/:provider
POST /payments/:id/refunds

## Trips/Messaging
GET/POST /trips
GET/PATCH /trips/:id
GET /trips/:tripId/share
GET /trips/:tripId/share/preview
POST/PATCH /trips/:tripId/share
POST /trips/:tripId/share/regenerate
POST /trips/:tripId/share/revoke
POST /trip-shares/resolve
GET/POST /conversations
GET/POST /conversations/:id/messages
GET /notifications
PATCH /notifications/:id/read

## Admin
GET /admin/verifications
POST /admin/verifications/:id/decision
GET/PATCH /admin/businesses/:id
GET/PATCH /admin/users/:id

Rules: DTO validation, consistent errors, pagination, Swagger, proper HTTP codes, idempotency for retry-sensitive commands.
