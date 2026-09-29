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

## Search
GET /search
GET /map/places

Both public discovery routes accept optional `locale=en|am` (invalid explicit values return 400). Omitted or `en` keeps canonical Destination matching and presentation. With `am`, Destination matching includes canonical fields plus complete, published Amharic `displayName` and `shortDescription`; translated `fullDescription` is required for completeness but is not searched. Destination names/snippets and map labels use the F1-resolved public fields. Attraction, Business, and Service matching is unchanged. The web client does not yet forward its locale cookie to these routes (F4A-2).

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
