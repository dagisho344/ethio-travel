# Admin Foundation and Audit Core (Phase 13A)

Phase 13A adds the administrator foundation for users, businesses, verification review integration, and append-only audit history. It deliberately does not add the later content-management, moderation expansion, reporting, analytics, system-settings, subscription, or production-hardening work.

## Authorization boundary

Every new backend route is protected by `JwtAuthGuard`, `RolesGuard`, and the existing `ADMIN` role decorator. The browser route gate and hidden navigation are convenience only; a traveler, business member, or guessed browser URL cannot authorize an API request. The Next.js BFF uses the existing HttpOnly session cookies and does not expose access or refresh tokens to JavaScript.

`/admin` is server-gated using the safe current-session snapshot. Anonymous visitors are sent to login with a fixed safe return target; authenticated non-administrators are sent to `/explore`.

## Routes

Backend API routes:

- `GET /api/v1/admin/dashboard`
- `GET /api/v1/admin/users`, `GET /api/v1/admin/users/:userId`
- `POST /api/v1/admin/users/:userId/suspend`, `POST /api/v1/admin/users/:userId/restore`
- existing `GET /api/v1/admin/businesses`, `GET /api/v1/admin/businesses/:id`
- `POST /api/v1/admin/businesses/:id/suspend`, `POST /api/v1/admin/businesses/:id/restore`
- existing `GET/POST /api/v1/admin/business-verifications/...`
- `GET /api/v1/admin/audit`

Same-origin BFF routes mirror dashboard, user, business, and audit reads/commands under `/api/admin`. They permit only known query keys, UUID route parameters, and `{ reason }` mutation bodies. Existing verification BFF routes remain the sole verification/document proxy.

Frontend routes:

- `/admin`
- `/admin/users`, `/admin/users/[userId]`
- `/admin/businesses`, `/admin/businesses/[businessId]`
- existing `/admin/verifications`, `/admin/verifications/[verificationId]`
- `/admin/audit`

The Admin Portal has a desktop sidebar and an Escape-closeable mobile drawer. Its route-aware top bar replaces marketplace chrome only for `/admin*`; public routes and the separate Business Portal remain unchanged.

## Lifecycle commands

User suspension and restoration are explicit reason-required commands. Suspension only transitions `ACTIVE → SUSPENDED`, revokes currently active sessions in the same transaction, and thereby prevents a previously issued JWT from continuing normal authenticated access. Restore only allows `SUSPENDED → ACTIVE`; `DEACTIVATED` is not restored by this command. Administrators cannot suspend themselves.

Business suspension only allows `ACTIVE` or `DRAFT → SUSPENDED`; it does not delete services, membership, bookings, payments, reviews, messages, or media. Existing members retain their permitted workspace/history access. The central public predicate already requires `ACTIVE + VERIFIED`, and the booking eligibility flow rejects suspended businesses, so suspension removes public eligibility and blocks new bookings without cancelling history.

Business restore is intentionally conservative: `SUSPENDED → ACTIVE` only when the verification summary is `VERIFIED`; otherwise it returns to `DRAFT`. This prevents restore from publishing an unverified or rejected business.

## Dashboard and safe detail data

The dashboard uses bounded database group/count queries for user, business, verification, and recent-action summaries. It does not fabricate charts or KPIs. User details expose a safe profile, roles, aggregate counts, and membership summaries—not password hashes, tokens, messages, or payment instruments. Business details expose safe profile, member, location/hour, service/media counts, and verification state summaries. They never expose verification object keys, signed URLs, private document names/content, or storage credentials.

## Audit design

`AuditLog` is append-oriented. There is no mutation or deletion route. It stores a nullable actor, action, entity type/id, outcome, bounded reason, allowlisted metadata, bounded request context, and timestamp.

The `20260914000001_admin_audit_core` migration is additive: it creates `AuditOutcome`, `audit_logs`, four query indexes, and a nullable `actor_user_id` foreign key with `ON DELETE SET NULL`. It contains no DROP, TRUNCATE, DELETE, reset, backfill, or mass update.

Required actions are recorded transactionally with their commands where applicable:

- `ADMIN_USER_SUSPENDED`, `ADMIN_USER_RESTORED`
- `ADMIN_BUSINESS_SUSPENDED`, `ADMIN_BUSINESS_RESTORED`, `ADMIN_BUSINESS_STATUS_CHANGED`
- `ADMIN_VERIFICATION_APPROVED`, `ADMIN_VERIFICATION_REJECTED`

Metadata only permits operation and transition state keys. It deliberately excludes passwords, tokens, authorization headers, private verification document names/content, object keys, signed URLs, raw request bodies, payment credentials, and secrets. The audit viewer exposes only safe actor/action/entity/outcome/reason/metadata summaries.

## Verification integration

Phase 12C verification queue and protected private document access are reused. Approval and rejection remain pending-state transitions in the existing service; they now write safe audit records inside the same transaction. Notification delivery remains outside the transaction and does not determine mutation success.

## Operational notes and deferrals

The local `apps/api/var/` runtime directory remains ignored and must never be staged or logged. Private verification files remain accessible only through existing protected admin document endpoints.

Deferred to Phase 13B/13C or later: destination/category CMS, expanded review moderation, booking/payment investigation, reports, global analytics, system settings, subscriptions/payouts, malware scanning, media workers, and broader production hardening.