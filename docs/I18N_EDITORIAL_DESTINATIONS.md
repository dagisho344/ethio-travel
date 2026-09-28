# Destination editorial translations — Phase 16D-F1

## Scope

Phase 16D-F1 adds a data and API foundation for optional Amharic editorial
content on platform-managed Destinations. Phase 16D-F2 adds the authenticated
Admin editor and same-origin BFF integration. Phase 16D-F3 consumes the
already resolved public representation on destination web surfaces and uses it
for destination-detail metadata. Amharic search and translations for Cities,
Regions, Attractions, categories, businesses, services, or media captions
remain out of scope.

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

## F3 public presentation and metadata

The web app does not inspect `DestinationTranslation` rows or reproduce the
F1 publication/completeness rules. Its server-only public-destination helper
obtains the validated `en` or `am` value from the existing server-readable
`et_locale` cookie and forwards that value only to the established public
Destination endpoints. It is used by the homepage destination cards, the
`/destinations` listing (including its region/city-scoped API calls), and the
scoped public destination detail page.

Consequently, the same F1-resolved `name`, `shortDescription`, and
`fullDescription` render on cards and the detail page. For `am`, missing,
draft, unpublished, or incomplete records arrive as the complete canonical
English/source object; the web app never constructs a mixed record or displays
translation lifecycle state to travelers. Existing IDs, slugs, city/region
identity, coordinates, and shared travel data remain canonical. No destination
travel-information UI was introduced because the existing public detail page
does not yet render that section; when it does, it must consume the resolved
`travelInfo` from F1 in the same way.

The detail page is explicitly dynamic and uses the existing no-store API
fetching so its cookie-dependent content and metadata cannot be cached for a
different locale. `generateMetadata` derives its title and description from
the same resolved public Destination response. The canonical browser route is
unchanged (`/regions/[regionSlug]/cities/[citySlug]/destinations/[destinationSlug]`);
F3 adds neither `/en`/`/am` routes nor hreflang alternatives.

Search and map APIs, matching, ranking, filters, and marker behavior remain
unchanged. Search's destination selector still uses its existing discovery
contract, and map labels continue to use the existing map contract. Business,
service, user-generated, and trip content remains untouched. `/shared-trip`
continues to remove its fragment token locally and resolve it only through the
existing same-origin POST route; F3 introduces no locale redirect or token
forwarding.

## Deferred work

- **F4:** Amharic search/indexing design, localized map/discovery contracts if
  separately approved, and regression hardening;
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
Amharic labels at desktop and narrow-mobile widths. For F3, check homepage
cards, the destination listing, region/city-scoped listing, and destination
detail in English; then repeat with a published Amharic translation, a missing
translation, and an unpublished or incomplete translation. Confirm direct
reloads and locale switching retain the canonical URL, inspect localized title
and description metadata, and recheck Search, Map, and shared-trip behavior.
