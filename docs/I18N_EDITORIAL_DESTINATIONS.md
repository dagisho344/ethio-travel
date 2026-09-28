# Destination editorial translations — Phase 16D-F1

## Scope

Phase 16D-F1 adds a data and API foundation for optional Amharic editorial
content on platform-managed Destinations. It does not add an Admin editor,
public web rendering, metadata localization, Amharic search, or translations
for Cities, Regions, Attractions, categories, businesses, services, or media
captions.

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

## Deferred work

- **F2:** authenticated Admin multilingual editor and Admin BFF/UI;
- **F3:** public web destination presentation and localized metadata;
- **F4:** Amharic search/indexing design and regression hardening;
- other platform/editorial, business-owned, and user-generated content remains
  in its original stored language.

## Verification

Focused service tests cover English/source behavior, Amharic publication
completeness, fallback, optional display-name behavior, normalized drafts,
composite identity use, publication lifecycle, and safe audit metadata.
Controller E2E coverage verifies locale validation, strict draft DTO bodies,
and Admin-only translation lifecycle routes. Manual browser verification is
deferred to F2/F3 because this phase intentionally adds no editor or public
web interface.
