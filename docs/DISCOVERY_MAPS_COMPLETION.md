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

## Nearby search and map behavior

Near Me is initiated only by a user action in the browser. The coordinate pair and radius are held in component state, are added only to the request being made, and are never written to URL parameters, browser storage, user profiles, or audit data.

The API validates latitude, longitude, and a 1 to 200 km radius. It first uses a bounding box for candidate queries, then applies Haversine distance for the final radius decision. Nearby discovery permits at most 1,000 bounding-box candidates across all requested entity types: the API rejects a broader request instead of silently truncating it before distance ordering. Therefore successful Nearby results have exact distance ordering, totals, and pagination within the bounded candidate window. This is an application response bound, not a schema-level geospatial index. Location permission failures leave the Region, City, and Destination filters available as the manual fallback.

## Map UI

The public map uses Leaflet and React Leaflet with `react-leaflet-cluster`. Marketplace markers are clustered, while the optional Nearby position is rendered independently. Markers show only public name, category, rating summary, distance when applicable, and canonical detail links. Bounds changes are debounced, and moving a selected list result to the map retains the selected marker key.

OpenStreetMap attribution remains visible. No map API key, paid geocoder, reverse geocoder, or device-location persistence is introduced.

## Deferred work

Phase 15 does not add PostGIS, a new geospatial index, maps-based advertising, address geocoding, stored device locations, a new search engine, offline maps, a booking/capacity engine, or payment changes. Those require separate product and operational review.