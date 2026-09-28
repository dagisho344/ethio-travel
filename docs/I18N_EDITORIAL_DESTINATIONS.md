# Destination editorial translations — Phase 16D-F1

## Scope

Phase 16D-F1 adds a data and API foundation for optional Amharic editorial
content on platform-managed Destinations. Phase 16D-F2 adds the authenticated
Admin editor and same-origin BFF integration. Public web rendering, metadata
localization, Amharic search, and translations for Cities, Regions,
Attractions, categories, businesses, services, or media captions remain out of
scope.

Existing `Destination` fields remain the canonical English/source record.
There are no generated or backfilled English translation rows.

## Model and migration

Migration `20260927000001_destination_translations` adds:

- `EditorialLocale` with exactly `en` and `am`;
- `destination_translations`, keyed by a UUID;
- a unique `(destination_id, locale)` constraint;
- an index on `(locale, is_published)`;
- a `RESTRICT` foreign key to `destinations`.

The table stores optional editorial text only: display name, short and full
description, and the four prose travel-guidance fields. It deliberately does
not duplicate numeric/shared `travelInfo` values such as
`estimatedStayDays`. The migration neither changes existing destination
columns nor rewrites or backfills existing rows.

## Public locale resolution

The existing routes remain canonical and now accept an optional validated
`locale` query parameter:

- `GET /api/v1/destinations?locale=am`
- `GET /api/v1/regions/:regionSlug/cities/:citySlug/destinations?locale=am`
- `GET /api/v1/regions/:regionSlug/cities/:citySlug/destinations/:destinationSlug?locale=am`

Omitted locale and `locale=en` always return canonical source content.
`locale=am` returns a translated overlay only when the Amharic translation is
published and contains non-empty `shortDescription` and `fullDescription`.
Otherwise the API returns the complete canonical source record, never a
partially translated prose record. A missing translated display name falls
back to the canonical destination name; missing optional travel-guidance
fields retain their canonical values. Shared travel data remains unchanged.

Invalid explicit locale values are rejected with HTTP 400. Public destination,
city, and region eligibility predicates are unchanged. Translation IDs,
publication fields, drafts, and translation collections are never included in
public responses.

## Admin lifecycle API

The following existing-guarded Admin routes use JWT authentication, the
existing `ADMIN` role guard, UUID validation, enum parsing, and global strict
DTO whitelisting:

- `GET /api/v1/admin/destinations/:id/translations/:locale`
- `PUT /api/v1/admin/destinations/:id/translations/:locale`
- `POST /api/v1/admin/destinations/:id/translations/:locale/publish`
- `POST /api/v1/admin/destinations/:id/translations/:locale/unpublish`

At F1, only `am` is a managed translation locale. English remains managed in
the canonical `Destination` fields, preventing redundant English translation
records. `PUT` normalizes trimmed empty optional strings to `null`, saves a
draft, and explicitly clears publication state. Publishing requires non-empty
short and full descriptions. Unpublishing clears `publishedAt`, so the next
public Amharic request immediately falls back to source content. Parent
destination publication is intentionally independent; parent public
eligibility still controls public visibility.

Limits are: display name 180, short description 300, full description 20,000,
and each travel-guidance field 1,000 characters. No arbitrary fields are
accepted.

## Audit and security

Saving, publishing, and unpublishing use the existing audit service. Audit
metadata contains only `destinationId` and `locale`; translated editorial
bodies are never copied into audit metadata.

F1 does not alter authentication, business authorization, media permissions,
search semantics, Booking, Payment, Refund, availability, reviews, trip
privacy, BFF same-origin protections, or `/shared-trip#token` handling.

## F2 Admin editor and BFF

The existing `AdminDestinationEditor` now retains the canonical English source
form in an **English (source)** tab and adds an **Amharic** tab for the single
managed `am` translation. The editor does not create or edit an English
translation row, and the Amharic tab deliberately excludes slugs, parent
publication state, city/region assignment, coordinates, IDs, and
`estimatedStayDays`.

The Admin web application uses fixed BFF endpoints rather than exposing API
credentials to the browser:

- `GET` and `PUT`
  `/api/admin/destinations/:destinationId/translations/am`;
- `POST`
  `/api/admin/destinations/:destinationId/translations/am/publish`; and
- `POST`
  `/api/admin/destinations/:destinationId/translations/am/unpublish`.

These routes validate a UUID, fix the locale to `am`, forward the existing
HttpOnly authenticated session, use the shared same-origin check for every
mutation, and use a strict seven-field body allowlist. The backend remains the
authorization authority: only its existing Admin JWT/role guards may read or
mutate a translation. Translation bodies are not logged by the BFF.

`Save translation draft` sends only the F1 translation fields and never
publishes. Because F1 intentionally treats a save as an unpublished draft,
editing a previously published translation returns public Amharic resolution to
the English source fallback until the administrator explicitly confirms
**Publish translation** again. The UI makes that outcome explicit. Publishing
checks trimmed short and full descriptions before confirmation; the API
revalidates the same rule. Unpublishing is separately confirmed and immediately
restores the English fallback.

The Amharic tab reports **Not created**, **Draft / English fallback**, or
**Published**. Its preview is entirely local to the authenticated Admin page:
it renders the saved published Amharic overlay only when it satisfies the
public completeness rule; otherwise it renders the canonical English source
fields. Draft content is never queried from or exposed by a public route.
Optional travel guidance follows the same per-field fallback as F1. Keyboard
arrow/Home/End tab selection, labelled tab panels, visible focus styling,
Escape dismissal for lifecycle confirmation, responsive wrapping, and readable
narrow-screen controls are included.

## Deferred work

- **F3:** public web destination presentation and localized metadata;
- **F4:** Amharic search/indexing design and regression hardening;
- other platform/editorial, business-owned, and user-generated content remains
  in its original stored language.

## Verification

F1 focused service tests cover English/source behavior, Amharic publication
completeness, fallback, optional display-name behavior, normalized drafts,
composite identity use, publication lifecycle, and safe audit metadata.
Controller E2E coverage verifies locale validation, strict draft DTO bodies,
and Admin-only translation lifecycle routes. F2 web tests cover catalog parity,
the English/source and Amharic tabs, lifecycle and fallback source usage,
validation limits, fixed BFF routes, strict mutation bodies, same-origin
forwarding, and continued shared-trip isolation.

Manual browser checks remain: an Admin should create an incomplete draft,
observe the English-fallback preview, save and publish a complete translation,
unpublish it, verify the confirmation/Escape behavior, and inspect English and
Amharic labels at desktop and narrow-mobile widths. F3 remains responsible for
validating the actual public destination page and localized metadata.
