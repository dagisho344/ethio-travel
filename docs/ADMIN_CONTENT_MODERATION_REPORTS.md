# Admin Content, Moderation, and Reports (Phase 13B)

## Scope

Phase 13B extends the existing Phase 13A Admin Portal with administration of
destinations and existing category domains, review moderation, and a focused
report-investigation workflow. It does not add payment investigations, global
analytics, system settings, subscriptions, or Phase 13C functionality.

All administration is enforced by the NestJS `JwtAuthGuard`, `RolesGuard`, and
`ADMIN` role. The Admin Portal and Next.js BFF routes are convenience layers;
they are not an authorization boundary.

## Domain architecture

- Destinations use the existing `Destination` model and its
  `PublicationStatus` lifecycle.
- Business categories and service categories remain separate existing domain
  models. Neither has a Phase 13B delete operation.
- Reviews continue to use the existing `Review` model and its publication
  lifecycle. Business review responses remain historical records.
- `Report` is the small, purpose-specific user-generated report model added in
  this phase. It does not copy target content or introduce a generic CMS
  entity.

The additive migration is
`20260915000001_content_moderation_reports`. It creates `ReportTargetType`,
`ReportStatus`, the `reports` table, query indexes, and restrictive reporter
and nullable-assignee foreign keys. It contains no `DROP`, `TRUNCATE`,
`DELETE`, reset, or data-rewrite statement.

## Destination CMS

Admin routes:

- `GET|POST /api/v1/admin/destinations`
- `GET|PATCH /api/v1/admin/destinations/:destinationId`
- `POST /api/v1/admin/destinations/:destinationId/publish`
- `POST /api/v1/admin/destinations/:destinationId/unpublish`

Creation and ordinary edits save a draft; they cannot supply an arbitrary
publication status. Publishing is a separate command. The backend confirms
that the destination has valid core data and belongs to an active city before
the state changes to `PUBLISHED`. Unpublishing changes a published destination
to `INACTIVE`, preserving trips, business references, reviews, and other
historical data.

Public discovery remains server-authoritative: ordinary destination queries
continue to require a published destination in the eligible location
hierarchy. The frontend never decides publication eligibility.

## Categories

`BusinessCategory` and `ServiceCategory` are administered through their own
existing APIs and UI sections. Admins can create and update bounded code,
name, description, active state, and existing sort order fields. Referenced
categories are not hard-deleted, so historical business and service
relationships remain valid. Deactivation preserves those relationships while
preventing new eligible use where existing domain rules check `isActive`.

## Review moderation

Admin review routes support safe listing/detail and explicit publish, reject,
hide, and restore actions. Actions use bounded moderation notes rather than
an arbitrary review patch. Hiding preserves the review, author, rating,
business relationship, and any business response, but public output still
requires `PUBLISHED`; hidden review responses therefore are not public.

Public rating aggregation continues to depend on the authoritative review
visibility status. A business member cannot moderate or rewrite traveler
review content through these admin capabilities.

## Reports

Authenticated users may create a report through `POST /api/v1/reports` for a
validated, reportable business, service, published review, or user. Input is
bounded, targets are checked server-side, self-reports of a user are rejected,
and duplicate open/under-review reports by the same reporter for the same
target and reason are rejected.

Report lifecycle:

`OPEN → UNDER_REVIEW → RESOLVED | DISMISSED`

Only admins can transition reports. Resolution/dismissal requires a bounded
resolution note. Admin report APIs are:

- `GET /api/v1/admin/reports`
- `GET /api/v1/admin/reports/:reportId`
- `POST /api/v1/admin/reports/:reportId/start-review`
- `POST /api/v1/admin/reports/:reportId/resolve`
- `POST /api/v1/admin/reports/:reportId/dismiss`
- `GET /api/v1/admin/moderation`

The queue returns only safe reporter and target summaries. It never provides
passwords, sessions, private verification files, storage object keys, signed
URLs, payment credentials, or unrelated private-message content.

## Audit trail

Sensitive Phase 13B operations are appended to the Phase 13A `AuditLog` in
the same transaction as the state change where practical:

- destination create/update/publish/unpublish;
- business/service category create/update;
- review publish/reject/hide/restore; and
- report review-start/resolve/dismiss.

Audit metadata is allowlisted to identifiers and state summaries such as
previous/new status, category type, destination/review/report ID, and target
type. It never records request bodies, tokens, cookies, authorization headers,
private verification contents or filenames, object keys, signed URLs, or
payment secrets.

## Admin Portal and BFF

The Phase 13A Admin Portal now includes real destinations, categories,
moderation, and reports navigation. Pages use the existing responsive admin
shell and mobile drawer:

- `/admin/destinations`, `/admin/destinations/new`, and destination detail/edit
- `/admin/categories`
- `/admin/moderation` and `/admin/moderation/reviews/:reviewId`
- `/admin/reports` and `/admin/reports/:reportId`

The matching Next.js BFF routes are under `/api/admin/destinations`,
`/api/admin/categories`, `/api/admin/reviews`, `/api/admin/reports`, and
`/api/admin/moderation`; authenticated user report submission is
`/api/reports`.

All mutating BFF calls require same-origin validation, use specific UUID/query
and body allowlists, and forward authentication only from HttpOnly session
cookies. Browser code receives neither access nor refresh tokens, and no BFF
route proxies arbitrary backend paths.

## Privacy and regression boundaries

Phase 13B does not change business membership authorization, booking capacity
rules, payment state, verification document privacy, or public business
eligibility. Existing business review response permissions (OWNER/MANAGER and
the established STAFF policy) remain intact. If an admin hides a review, the
response remains historical but is excluded from public rendering with its
review.

## Deferred work

Phase 13C and later phases may add financial investigations, expanded content
workflows, analytics, settings, subscriptions, production moderation tooling,
and any approved destination/media editorial capabilities. Malware scanning,
thumbnail processing, and private-file retention workers remain outside this
phase.
