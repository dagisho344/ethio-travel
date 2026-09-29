# Discovery and Maps Completion

## Canonical public routes

`/search` is the canonical discovery experience. It provides a single filter state for public destinations, attractions, verified businesses, and published services, with list and map modes. `/explore` is retained only as a compatibility redirect to `/search`, and `/map` redirects to `/search?view=map`.

Public business and destination links retain their scoped-slug identities:

- `/regions/[regionSlug]/cities/[citySlug]/businesses/[businessSlug]`
- `/regions/[regionSlug]/cities/[citySlug]/destinations/[destinationSlug]`

## Public APIs and eligibility

Discovery reuses the existing `GET /api/v1/search` and `GET /api/v1/map/places` endpoints. Both compose the central public-visibility predicates rather than recreating publication rules. Draft, inactive, suspended, unverified, and otherwise ineligible content remains excluded.

Search and marker records use explicit, public-safe Prisma selects. They do not load memberships, owners, verification data, bookings, payments, moderation data, audit records, or private media metadata. Map ratings are aggregated by entity type with database `groupBy` operations rather than per-marker queries.

The map endpoint uses deterministic per-type ordering, a bounded marker limit, and fair round-robin merging so the first entity type cannot consume the entire marker result. Map and Search both validate bounded pagination, scope chains, category filters, and price filters. A numeric price range requires both one pricing model and one ISO currency, so neither endpoint compares numeric prices across currencies or pricing models.

## Exact ordinary Search ranking and paging (F4A-0)

Ordinary Search now selects its final ranked page in PostgreSQL before hydrating public records. Previously, each entity type supplied an alphabetically ordered prefix, after which application relevance sorting and pagination could repeat weaker matches and omit stronger matches outside that prefix.

The narrowly scoped ranked-ID query compiles the existing Search Prisma predicates, including the central public-visibility builders, through closed field/relation/operator maps. User values are bound parameters; sort branches and SQL identifiers are allowlisted constants. Unsupported future predicates fail closed rather than silently weakening eligibility. The query returns only page IDs, entity types and the exact total. Explicit existing Prisma selects hydrate only those selected IDs, and the API restores their ranked order. Ranking, total and hydration share a repeatable-read transaction snapshot.

Ordinary ordering uses canonical stored names and the existing PostgreSQL database collation, not UI locale collation:

- Relevance: literal case-insensitive name substring score (2) before prose-only score (1), then canonical name ascending, entity type ascending and UUID ascending. With no query, all relevance scores are zero. Ordinary Search folds both the name and bound query in PostgreSQL; mixing JavaScript and database Unicode case folding could otherwise incorrectly demote a literal name match.
- Name: canonical name in the requested ascending/descending direction, then entity type ascending and UUID ascending.
- Newest: creation timestamp descending, then canonical name ascending, entity type ascending and UUID ascending.

This clarifies previously inconsistent application-vs-database ties without adding linguistic ranking or translation matching. Existing case-insensitive substring qualification (including its LIKE wildcard semantics) remains unchanged. Totals come from the same qualifying relation as the ordered page, including when a requested page is empty. There is no ordinary-search 1,000-candidate truncation or new broad-search rejection. The existing `page * limit <= 1000` access-window validation and per-page limit remain unchanged; exact totals can exceed that access window. Performance of large production datasets still requires benchmarking; this checkpoint adds no index, extension or migration.

## Nearby search and map behavior

Near Me is initiated only by a user action in the browser. The coordinate pair and radius are held in component state, are added only to the request being made, and are never written to URL parameters, browser storage, user profiles, or audit data.

The API validates latitude, longitude, and a 1 to 200 km radius. It first uses a bounding box for candidate queries, then applies Haversine distance for the final radius decision. Nearby discovery permits at most 1,000 bounding-box candidates across all requested entity types: the API rejects a broader request instead of silently truncating it before distance ordering. Therefore successful Nearby results have exact distance ordering, totals, and pagination within the bounded candidate window. This is an application response bound, not a schema-level geospatial index. Location permission failures leave the Region, City, and Destination filters available as the manual fallback.

## Map UI

The public map uses Leaflet and React Leaflet with `react-leaflet-cluster`. Marketplace markers are clustered, while the optional Nearby position is rendered independently. Markers show only public name, category, rating summary, distance when applicable, and canonical detail links. Bounds changes are debounced, and moving a selected list result to the map retains the selected marker key.

The bounds reporter also refreshes a stationary viewport when marker request intent changes: query, entity types, scoped location, categories, supported pricing filters or ephemeral Nearby state. List-only page/sort/view changes do not issue redundant marker requests. The map is not remounted or recentered by these intent changes. A pending bounds debounce is cancelled when intent changes. Initial mount and `moveend` continue requesting current viewport bounds with the existing 200-marker UI request limit; backend marker caps, eligibility, clustering, geography and rating aggregation are unchanged.

Search and Map responses must match both the latest request version and current intent before committing success, error or loading state. This also guards the interval between a new render and its next effect; cleanup invalidates requests on unmount. Older responses cannot overwrite a newer intent or bounds request. No coordinates are persisted and no browser-storage behavior is added.

## F4A-0 verification and boundaries

Focused tests first reproduced the pre-ranking prefix defect and the stationary-map missed request. Unit tests cover bounded page hydration, snapshot use, bound SQL values and unsupported-predicate failure. Opt-in PostgreSQL integration tests exercise the actual ranked query, tie ordering, pagination/total correctness, more than 1,000 ordinary matches, filter/security equivalence against central Prisma predicates and public response fields. Fixtures live in randomly scoped regions and are always rolled back; existing application rows are not mutated.

Run the database-backed suite from `apps/api` with `DISCOVERY_DATABASE_TESTS=1` and `pnpm exec node --env-file=.env node_modules/jest/bin/jest.js --config test/jest-e2e.json --runInBand search-ranking.database.e2e-spec.ts`. It is explicitly skipped without that opt-in rather than claiming mock SQL verification. Native Node web tests execute the actual bounds-reporter effects, query helpers, Search effects and marker handler using deterministic hook/request adapters and the already-installed TypeScript compiler. Real-browser map interaction and production-scale latency are separate manual acceptance checks.

F4A-0 itself did not introduce Search/Map localization. F4A-1 subsequently added optional validated `locale=en|am` to those API routes. Omitted/English requests retain the canonical path; Amharic requests match canonical Destination text or complete, published Amharic `displayName`/`shortDescription`. Translated `fullDescription` is checked for publication completeness but is not searched. One `EXISTS` predicate per Destination keeps counts and ranked IDs deduplicated; qualified IDs are hydrated through bounded explicit public selects. The same qualification is applied before Nearby and map candidate limits. Only Destination result name/snippet and map-marker name can be localized. F4A-2 now resolves `et_locale` at the `/search` server boundary and forwards validated `en|am` on Search/Map requests and public Destination selector queries. Locale participates in Search and stationary Map request intent, so previous-locale responses cannot replace current data. A label-only marker update does not refocus the selected place or reset the viewport. Browser URLs, filters, coordinates, marker bounds/caps, other entity matching and clustering remain unchanged. F4A-3 now records synthetic-scale performance and the no-migration index decision below; deployment-target measurement remains separate. Protected Favorites/Reviews, canonical URLs and secure shared-trip fragment resolution are unaffected.

Checkpoint verification: 37 API unit suites / 338 tests; 18 API E2E suites / 93 tests, including 10 actual PostgreSQL ranking tests; 195 native web tests. Targeted Prettier, changed-file API lint, API/web typechecks, web lint, production web build (including page generation and traces) and `git diff --check` passed. Full API lint remains blocked by four pre-existing unsafe-assignment errors in the unchanged `src/destinations/destinations-translations.phase16.spec.ts` at lines 181, 192, 193 and 244; they also reproduce from committed HEAD. They were not changed as part of discovery correctness.

Manual browser acceptance remains outstanding: on desktop and narrow mobile, verify relevance/name/newest paging, stationary query and filter changes, rapid successive Search/Map requests, list/map switching, retained viewport, marker clustering and popup links, and Near Me granted/denied with manual location fallback. Production-scale query latency and cross-request pagination under concurrent catalog edits are separate operational checks; the deterministic no-repeat/no-omission guarantee applies to stable fixtures and each request uses a consistent snapshot.

OpenStreetMap attribution remains visible. No map API key, paid geocoder, reverse geocoder, or device-location persistence is introduced.

## Deferred work

Phase 15 does not add PostGIS, a new geospatial index, maps-based advertising, address geocoding, stored device locations, a new search engine, offline maps, a booking/capacity engine, or payment changes. Those require separate product and operational review.

## F4A-3 performance assessment

An opt-in PostgreSQL benchmark now executes the actual Search and Map services
with 100, 1,000 and 10,000 synthetic Destinations, mixed translation lifecycle
states and related Attractions/Businesses/Services. It records a first-observed
warm-up, five-run service medians and captured production-query
`EXPLAIN (ANALYZE, BUFFERS)` metrics. Fixtures roll back; a scoped final ANALYZE
refreshes live planner estimates because not all ANALYZE effects are transactional.
The suite verifies original row counts, fixture absence, indexes and extensions.

Broad selective/no-match queries show a concerning cost trend at the largest
scale. Cross-table OR substring qualification dominates several plans; exact
ranking also costs more for common queries. Existing scope/PK/coordinate indexes
serve bounded queries. No particular new index has demonstrated an improvement
on the complete production query, so this checkpoint adds **no index, extension
or migration**. This is not a production latency certification. A separately
approved trigram/query-shape comparison and deployment-target measurement are
the next steps if production traffic reaches the measured scale or latency/CPU
targets are missed. See [the full method, timings, plans and index decision](DISCOVERY_PERFORMANCE_F4A3.md).
