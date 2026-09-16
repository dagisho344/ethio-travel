# Admin Operations, Analytics, and Settings

Phase 13C completes the bounded operational tools in the Admin Portal. It adds
investigation views for bookings and payments, database-derived analytics, and
a deliberately small typed settings surface. It does not add a payment gateway,
subscription billing, payout administration, global configuration storage, or
Phase 14 marketplace work.

## Authorization and portal routes

Every API route below is protected by `JwtAuthGuard`, `RolesGuard`, and the
server-side `ADMIN` role requirement. The Next.js pages are only a convenience
layer; direct non-admin API requests remain forbidden.

The Admin Portal navigation groups the completed tools under Operations,
Insights, and System:

- `/admin/bookings` and `/admin/bookings/[bookingId]`
- `/admin/payments` and `/admin/payments/[paymentId]`
- `/admin/analytics`
- `/admin/settings`

The existing light Admin Portal chrome, responsive desktop sidebar, and mobile
drawer are reused without changing Business Portal presentation or membership
authorization.

## Booking investigation

`GET /api/v1/admin/bookings` supplies a paginated investigation list. Its
allowlisted filters are page, limit, booking status, reference, traveler,
business, service, booking start range, and creation range. Searches are
bounded, case-insensitive text matches; clients cannot submit arbitrary Prisma
filters or sort fields.

`GET /api/v1/admin/bookings/:bookingId` returns a safe booking record, schedule,
price snapshot, traveler display identity, related payment summaries, lifecycle
history, and safe audit entries. Payment information is selected only by the
admin projection, not added to ordinary traveler or business booking responses.

Phase 13C intentionally adds no generic admin status patch, force-confirm,
force-complete, or force-cancel command. Existing transactional capacity and
booking-transition rules remain the authority. Historical bookings are never
hard deleted. Suspended businesses remain unable to receive new bookings under
the existing public eligibility/bookability checks.

## Payment and refund investigation

`GET /api/v1/admin/payments` and `GET /api/v1/admin/payments/:paymentId` expose
only safe operational data: identifiers, safe provider reference, booking,
traveler display identity, business/service, amount, currency, payment state,
timestamps, transaction summaries, refunds, and safe audit entries. They never
return card data, provider credentials, webhook payloads/signatures, or payment
secrets.

Booking status and payment status remain explicitly separate in the UI and API.
There is no “Mark paid”, force-success, force-refund, or arbitrary payment state
update. Provider webhooks and the established server-side payment/refund domain
logic remain authoritative.

The existing authenticated admin refund route is retained. A newly created
admin refund request is recorded transactionally as
`ADMIN_PAYMENT_REFUND_REQUESTED`; it records only the payment ID and currency,
not provider secrets or raw financial payloads. The audit action documents the
request, while the existing provider outcome continues to determine refund and
payment state.

## Analytics

`GET /api/v1/admin/analytics` uses bounded database `count`, `groupBy`, and
aggregate queries. It returns:

- user totals by status and registrations in the last 30 days;
- business totals by status and verification summary;
- booking totals by status and booking volume in the last 30 days;
- payment counts by status;
- captured gross, succeeded refunds, and net grouped by currency;
- published destination/review counts, open reports, and pending verifications.

Captured revenue is based only on authoritative payment states (`PAID`,
`PARTIALLY_REFUNDED`, and `REFUNDED`) and completed (`SUCCEEDED`) refunds. All
money remains Prisma Decimal arithmetic until serialized. Currency totals are
returned independently—EthioTravel does not convert or combine ETB, USD, or
other currencies into a fabricated global revenue total.

## Typed platform settings

The additive `PlatformSettings` singleton is intentionally not a generic
key/value or secret store. It permits only these nullable, typed support fields:

- `supportEmail`
- `supportPhone`
- `supportMessage`

`GET /api/v1/admin/settings` returns these safe values, and
`PATCH /api/v1/admin/settings` accepts only those exact names. Empty updates and
unknown fields are rejected. Database URLs, JWT/session secrets, cloud storage
credentials, SMTP credentials, payment keys, webhook secrets, and arbitrary
secret-like fields cannot be administered here. Each saved update creates an
`ADMIN_SYSTEM_SETTINGS_UPDATED` audit entry with the changed field names only.

## BFF security

Same-origin BFF routes are provided for booking investigation, payment
investigation, analytics, and settings under `/api/admin/...`. They use the
existing HttpOnly session refresh/forwarding helper, UUID validation for detail
paths, explicit query allowlists, and controlled response/status propagation.
Mutating settings requests are same-origin checked and have a strict body
allowlist. Access and refresh tokens are never returned to browser JavaScript,
stored in browser storage, URL parameters, or rendered page data.

The web test runner is Node's native static-source suite and does not load or
execute Next.js TypeScript route handlers. Phase 13C therefore keeps focused
static BFF assertions for route allowlists, UUID validation, and same-origin
delegation, while API e2e tests remain the runtime enforcement coverage. A
Next route-handler runtime harness is deferred rather than adding a new test
framework solely for this phase.

## Audit and privacy boundary

Phase 13C reuses the append-only AuditLog foundation. New entity types include
booking, payment, and platform settings. Metadata remains allowlisted to safe
scalar values such as IDs, currency, and changed setting names. The audit system
rejects raw request bodies, cookies, authorization headers, card data, webhook
payloads, provider credentials, signed URLs, private verification paths, and
other secrets.

## Database migration

`20260915000002_admin_operations_settings` is additive. It creates only the
`platform_settings` table and its singleton unique index. It contains no DROP,
TRUNCATE, DELETE, UPDATE, reset, or modification to existing booking, payment,
business, traveler, or audit data.

## Deferred work

Phase 13C does not implement financial reconciliation, bank payouts,
subscription billing, new payment gateways, manual payment-state overrides,
booking/payment investigation workflows beyond the safe views above, analytics
warehousing, production infrastructure hardening, or any Phase 14 marketplace
expansion.
