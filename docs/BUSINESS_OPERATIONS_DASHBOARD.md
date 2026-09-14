# Business operations dashboard (Phase 12D)

## Purpose and access

The protected operational workspace is rooted at `/businesses/manage/:businessId`. It is a business-member surface, not an administration or payout system. Every API operation checks the authenticated user's **active membership for the exact business** on the NestJS server; a URL business ID, a client role, or a service/booking ID never grants authority by itself.

`OWNER`, `MANAGER`, and `STAFF` may read the dashboard, services, availability, bookings, customers, reviews, and payment history. `OWNER` and `MANAGER` may create/edit/publish/archive services, change availability, use legal booking transitions already implemented by the booking state machine, and create or update an official review response. `STAFF` receives read-only service/availability/review access and does not see write controls. Existing booking policy remains authoritative: booking state actions require owner or manager. Inactive or unrelated members are denied.

## Dashboard and KPI definitions

`GET /api/v1/my/businesses/:businessId/dashboard` returns compact, server-derived data only:

- Business identity, business status, verification summary, and active primary location.
- Service counts: all non-archived services and published services.
- Booking counts: pending, future confirmed, completed, and cancelled-by-traveler/business.
- Published-review count, average rating, and the count without an active official response.
- Revenue totals grouped by currency. Gross is the sum of `PAYMENT_CAPTURED` transactions with `SUCCEEDED` status; refunded is the sum of `SUCCEEDED` payment refunds; net is gross minus refunded. Booking price snapshots, pending/failed payments, and currency conversion are never used.

The query uses aggregate/count/group-by operations rather than loading booking, review, message, gallery, or transaction histories just to render the dashboard. The dashboard deliberately has no fabricated KPI values and no payout/accounting interpretation.

## Services and availability

The workspace service page reuses the existing business-scoped service APIs:

- `GET`/`POST /api/v1/my/businesses/:businessId/services`
- `GET`/`PATCH /api/v1/my/businesses/:businessId/services/:serviceId`
- `POST .../:serviceId/publish`, `unpublish`, and `archive`

Availability remains the existing Phase 7 authoritative system, reached through its existing service endpoints for booking configuration, recurring rules, and date-specific overrides. It retains server-side overlap, capacity, lead-time, booking-horizon, pending/confirmed occupancy, and suspension checks. The browser never decides final bookability.

Publishing a service does not verify or publish the business. Public eligibility remains the existing active, verified, eligible business and service predicates. A suspended business remains hidden/non-bookable while authorized members can read historical bookings and payments.

## Bookings, customers, and payments

The operations booking page reuses the existing business booking endpoints and state machine. It only presents legal actions; users cannot assign arbitrary booking statuses. Payment status remains separate from booking status.

Customers are derived from bookings that belong to the exact business. The customer list exposes only display name, per-business booking count, latest booking time, future-confirmed count, and completed count. It excludes emails, passwords, session data, addresses, unrelated trips, and unrelated customer lookup. The payment ledger is read-only and uses existing payment/transaction/refund records; it exposes no provider credentials or raw webhook data.

## Reviews and official responses

Phase 12D adds `ReviewResponse`, with restrictive foreign keys to the review, business, and author. Its `(reviewId, businessId)` uniqueness yields one current official response for a review/business. Only owner/manager members can upsert a response, and only if the review is already `PUBLISHED` and belongs directly to the business or one of its services. The business never changes the traveler's rating, text, or moderation status.

Public review output includes only the active response body and timestamps for already-public reviews. It does not expose response author IDs/email or moderation notes. Hidden/rejected reviews never become public through a response.

## Routes and BFF

The workspace routes are:

- `/businesses/manage/:businessId` — dashboard
- `/businesses/manage/:businessId/services`
- `/businesses/manage/:businessId/services/:serviceId/availability`
- `/businesses/manage/:businessId/bookings`
- `/businesses/manage/:businessId/customers`
- `/businesses/manage/:businessId/reviews`
- `/businesses/manage/:businessId/payments`
- `/businesses/manage/:businessId/settings`

The matching Next.js BFF routes live below `/api/businesses/manage/:businessId`. They reuse the existing HttpOnly-cookie/session helpers. Mutation helpers validate same origin and allowlist fields; access and refresh tokens are never available to browser JavaScript. Existing booking/payment BFF routes are retained and reused rather than duplicated.

## Deferred work

Phase 12D deliberately excludes subscriptions, bank payouts, full accounting, global analytics, advanced discovery ranking/open-now filters, public CMS redesign, malware scanning, thumbnail workers, partner APIs, and a full admin dashboard. Standard verification/media privacy, booking/payment authority, notifications, messaging, Trip Planner, and AI grounding continue unchanged.