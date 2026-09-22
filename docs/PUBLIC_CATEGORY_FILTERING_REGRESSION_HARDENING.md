# Public category filtering and regression hardening

## Scope

Phase 14H hardens the existing public Service marketplace without adding a
schema change, migration, category-code branch, or category-specific booking,
payment, or availability system. `Service` remains the public aggregate root.

## Category families

Public Service filtering and category marketplace pages use the stable,
database-managed `ServiceCategory.family` discriminator. The four completed
family pages are locked to their family server-side:

- `/hotels` — `ACCOMMODATION`
- `/restaurants` — `RESTAURANT`
- `/tours` — `TOUR`
- `/transport` — `TRANSPORT`

The browser may choose filters for a page, but it cannot change the page's
family. The API applies the family predicate in the Prisma query; it does not
fetch a broad result set and filter it in application code. Display names and
individual category codes are not used as domain discriminators.

## Filters and validation

The generic public Service list supports bounded search, active category,
location scope, pricing model, and minimum/maximum Service price filters. The
category pages additionally expose only the family-specific filters that their
family supports:

- Accommodation: `starClass`, `minRoomCapacity`
- Restaurant: `reservationSupported`, `deliverySupported`
- Tour: `minDurationDays`, `maxDurationDays`
- Transport: origin and destination region/city scope

The backend is authoritative. It rejects invalid location nesting
(`citySlug` without `regionSlug`, and `destinationSlug` without both), reversed
price or tour-duration ranges, invalid booleans, and specialized filters used
with the wrong category family. Boolean parsing is deliberately strict:
only the strings `true` and `false` become booleans.

Category lookup remains database-filtered to active `ServiceCategory` records,
and can be family-scoped for marketplace controls.

## Pagination and UI behavior

Public list pagination remains bounded by the shared pagination DTO. Validated
queries use database `skip`/`take`, and the Service list has deterministic
ordering by `name` then `id`. Pagination links preserve the supported filters;
all filter changes and Clear Filters actions reset the page to one.

The public UI obtains category, region, and city controls from the existing
safe public APIs. It does not hard-code category codes or location lists.

## Public projections and privacy

The public Service list and public Service detail now have different explicit
Prisma selects:

- List cards select only the compact public Service, category, business,
  location, destination, and controlled hero/logo media summary required to
  render the marketplace.
- Detail reads retain the existing family detail sections and their existing
  deterministic relation bounds.

Neither projection selects membership, owner/user records, verification
documents, audit data, bookings, payments, reports, or other management-only
relations. Central Service and Business eligibility remains unchanged: only
eligible published Services of active, verified businesses in active public
locations can be returned. Suspension and existing destination eligibility
rules continue to apply in the database query.

## Boundaries preserved

Phase 14H does not alter `Booking`, `Payment`, refunds, `ServiceAvailability`,
capacity transactions, public business eligibility, or business workspace
authorization. It introduces no public endpoint outside the existing Service
architecture and no map/near-me functionality.

## Testing

Regression coverage verifies family predicates, family/specialized filter
validation, strict boolean handling, nested location constraints, stable list
ordering, compact list selection, filter-preserving pagination, category-page
family locking, and the absence of code-based category branching.

## Deferred work

Phase 14H intentionally defers map and near-me discovery, advanced geospatial
filters, broader search ranking, and Phase 15 work.
