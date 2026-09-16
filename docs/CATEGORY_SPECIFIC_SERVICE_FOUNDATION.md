# Category-Specific Service Foundation

## Phase 14A scope

Phase 14A adds the persistence foundation for accommodation, restaurant, tour, and transport content. It intentionally does not add category-specific forms, public marketplace routes, inventory engines, availability engines, booking flows, or search filters. Those capabilities are deferred to the later Phase 14 sub-phases.

## Service remains the aggregate root

`Service` remains EthioTravel's common product aggregate. It continues to own the business, database-driven `ServiceCategory`, shared price/currency fields, lifecycle, media, reviews, availability, and common booking relationship. The category extensions are all optional one-to-one records:

```text
Service
├── 0..1 AccommodationDetail ── 1..* RoomType
├── 0..1 RestaurantDetail ── 0..* RestaurantMenu ── 0..* RestaurantMenuItem
├── 0..1 TourDetail ── 0..* TourItineraryItem
└── 0..1 TransportDetail ── 0..* TransportRoute ── 0..* TransportSchedule
```

There are no `HotelBooking`, `RestaurantBooking`, `TourBooking`, or `TransportBooking` aggregates. Existing generic services remain valid when all four detail relations are null.

`ServiceCategory` remains a database-managed model. Phase 14A adds no category enum or discriminator: the one-to-one extension records define the specialized content only when it is applicable.

## Accommodation

`AccommodationDetail` has one unique `serviceId`, optional `starClass`, and optional `checkInTime`/`checkOutTime`. Check-in and check-out are stored as `CHAR(5)` local wall-clock text, rather than as a UTC instant tied to an arbitrary date.

`RoomType` belongs to an accommodation detail and contains the name, optional description, capacity, quantity, active state, Decimal `basePrice`, and explicit three-letter currency. It does not reserve inventory or participate in booking capacity in Phase 14A.

## Restaurant

`RestaurantDetail` holds an extensible PostgreSQL `VARCHAR[]` cuisine list and boolean reservation/delivery support flags. Cuisine is deliberately not an enum.

`RestaurantMenu` provides active and deterministic ordering. `RestaurantMenuItem` provides an optional section, name, optional description, Decimal price, explicit currency, availability flag, and deterministic ordering. Menu management UI and reservation/delivery behavior are deferred.

## Tour

`TourDetail` contains optional duration days, bounded difficulty text, meeting point, and typed inclusion/exclusion arrays. `TourItineraryItem` has day and sort ordering; the unique `(tourDetailId, dayNumber, sortOrder)` constraint gives deterministic provider-defined product content. It is separate from a traveler's Trip Planner.

## Transport

`TransportDetail` holds optional bounded `mode` and `operatorName` text. It intentionally does not introduce a rigid transport-company or mode enum.

`TransportRoute` uses existing `City` IDs as origin and destination. City already is the normalized regional hub in the application, so this avoids a second location system. More granular route stops or geospatial route modeling are deferred to Phase 14E/15.

`TransportSchedule` represents a concrete dated departure and arrival as UTC `DateTime` values, together with Decimal fare, explicit currency, capacity, and active state. Recurring local schedule semantics have not been established, so they are intentionally deferred. Transport schedule capacity is not connected to `ServiceAvailability` or booking capacity in this phase.

## Money, time, and history

All added money uses PostgreSQL `DECIMAL(12,2)` through Prisma `Decimal`; every such field also has a required `CHAR(3)` currency. The system does not convert or combine currencies.

All new detail relationships use restrictive foreign keys. Deactivating a service continues to preserve its detail content, room types, menus, itineraries, routes, schedules, and all historical bookings, payments, refunds, reviews, media, and audit records. No hard-delete behavior or cascading deletion was added.

## Public eligibility

Phase 14A does not change public-service projection or eligibility. Existing central checks still require the service and its business/category/location hierarchy to be eligible. Suspended, draft, and unverified businesses remain excluded. No extension-table endpoint can bypass that rule.

## Migration and compatibility

Migration `20260916000001_category_specific_service_foundation` is additive: it creates only ten new extension/content tables, indexes, unique one-to-one service constraints, and restrictive foreign keys. It performs no backfill. Existing services require no extension row and remain compatible with service CRUD, availability, booking, payment, review, search, media, trip, business portal, and admin portal behavior.

The relation and query indexes cover the intended foundation access paths: detail children, active/order menu content, itinerary order, transport route endpoints, and active/due transport schedules. They avoid speculative search or geospatial indexing.

## Deferred work

- Phase 14B: Accommodation completion, including product/editor and room inventory decisions.
- Phase 14C: Restaurant completion, including menu and reservation/delivery workflows.
- Phase 14D: Tour completion, including itinerary management.
- Phase 14E: Transport completion, including route/schedule management and safe booking-capacity integration.
- Phase 14F: Business Portal category-aware editors.
- Phase 14G: Public category marketplace and detail completion.
- Phase 14H: Category filtering and regression hardening.
- Phase 15: Discovery, maps, Near Me, and advanced category-specific filtering.
