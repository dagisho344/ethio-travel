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

At F3, Search and map APIs, matching, ranking, filters, and marker behavior
remained unchanged. F4A-1 later added explicit optional `locale=en|am` on the
existing Search and Map APIs. Omitted/English requests retain canonical
Destination matching and display. Amharic requests also match complete,
published Amharic `displayName` and `shortDescription`, while continuing to
match canonical English fields including canonical `fullDescription`.
Translated `fullDescription` is required for completeness but deliberately
excluded from matching. A single qualified Destination identity is counted
and paginated even when both languages match. The F1 shared resolver supplies
the Destination Search name/snippet and Map label, with complete English
fallback for missing, draft, unpublished, or incomplete translations. Other
entity types, filters, coordinates, marker caps, and canonical ordering remain
unchanged. F4A-2 now forwards the server-resolved locale to discovery and
uses the F1 public Destination endpoint for selector labels. Production-scale
query performance and any index proposal belong to F4A-3.
No schema change or migration was added for F4A-1. Business, service,
user-generated, and trip content remains untouched. `/shared-trip`
continues to remove its fragment token locally and resolve it only through the
existing same-origin POST route; F3 introduces no locale redirect or token
forwarding.

## Deferred work

- **F4A-3:** measure production-scale translated discovery queries and propose
  an additive index only if evidence shows one is needed;
- other platform/editorial, business-owned, and user-generated content remains
  in its original stored language.

## F4A-2 Search and Map web integration

The existing `/search` Server Component reads `et_locale` through
`getRequestLocale`, which resolves missing or invalid values to `en`. It passes
only typed `en|am` to the existing client. The public Destination options use
`safeDestinationPage` and the same locale, so their labels are F1-resolved
while filter values remain canonical slugs. Region, City and arbitrary category
database names remain canonical; no other persisted content is translated.

Search and Map request builders append the validated locale to their existing
public API parameters, not to the browser-facing URL. The locale joins both
request identities: a language switch refreshes Search and stationary Map data
without resetting filters, Near Me coordinates or map bounds. Existing
request-version and intent guards reject old-locale success, error and loading
updates. The map's selection focus now depends on place identity and
coordinates, so a refreshed translated label cannot recenter or zoom an
unchanged selection. Cards and popups render the API-returned name and snippet;
the web neither fetches translation rows nor reconstructs publication rules.

Discovery fetches retain `no-store`, canonical `/search` and scoped detail
links, and the existing `/shared-trip#token` behavior is unchanged. No Prisma
schema, migration, index, extension, backend ranking, or locale-prefixed route
was added in F4A-2. Real-browser desktop/mobile switching, viewport, Near Me
permission and rapid-change checks remain manual acceptance tasks.

F4A-2 automated verification includes runtime cookie resolution, server-loaded
Destination options, Search/Map parameter preservation, stationary locale
refresh, late old-locale success/error/loading rejection, and real card/popup
rendering of English, resolved Amharic and English-fallback API fixtures.
Canonical IDs, scoped slugs and selector values are asserted unchanged. The
full web suite passes 202 tests; relevant API regressions pass 29 unit tests
and 21 E2E tests across five suites, including the real PostgreSQL ranked-ID
path. Targeted formatting, web lint, web typecheck and the complete production
web build pass. These results do not certify full API lint: the four known,
unchanged unsafe-assignment errors in the F1 test remain outside this checkpoint.

Manual F4A-2 acceptance is still required (no runtime browser was available):

- On desktop and narrow mobile, search in English, switch to Amharic and back
  without changing the query, and confirm API-resolved Destination text and
  fallback text render while the same route/query/view/page remain intact.
- On `/search?view=map`, record the viewport and zoom, switch languages without
  moving the map, and verify refreshed Destination popup labels without a
  viewport/zoom reset; check clustering and canonical detail links.
- Preserve Region, City, Destination, category and pricing selections during
  switching; only the Destination option label should localize, never its slug.
- Rapidly switch `en -> am -> en` while changing query/filters and confirm no
  old-language result, marker, error or loading state replaces the current one.
- Test Near Me with permission granted and denied/manual fallback; switching
  languages must not request permission again or discard valid coordinates.

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
