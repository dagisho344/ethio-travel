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
GET /destinations/:slug
GET /destinations/:id/attractions

## Search
GET /search
GET /search/nearby

## Businesses
POST /businesses
GET /businesses/:slug
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
