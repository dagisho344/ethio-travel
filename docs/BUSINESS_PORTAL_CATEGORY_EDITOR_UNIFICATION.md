# Business Portal category-aware Service editor unification

## Phase 14F purpose

Phase 14F unifies Business Portal navigation for the existing generic `Service`
aggregate and its category-specific extension editors. It does not merge
accommodation, restaurant, tour, or transport into parallel product, booking,
payment, or availability systems.

The canonical generic workspace is:

`/businesses/manage/:businessId/services/:serviceId`

It uses the existing scoped Service BFF/API for generic details. The Business
Portal journey is:

```text
Business → Services → Service workspace → General / Category details / Availability
```

## Service architecture and category resolver

`Business` plus `Service` remains the common architecture. A typed, explicit
`getServiceCategoryEditor` resolver chooses the specialized editor from
`ServiceCategory.family`, never a category code or display name:

| Family | Editor |
| --- | --- |
| `ACCOMMODATION` | Accommodation Details |
| `RESTAURANT` | Restaurant Details |
| `TOUR` | Tour Details |
| `TRANSPORT` | Transport Details |
| `OTHER` or an unknown runtime value | No specialized editor |

The mapping has fixed route segments. It never derives a path from a runtime
family string. Future database-managed codes such as `HOTEL_PREMIUM` or
`BUS_TRANSFER` need no frontend change once an administrator assigns the
proper family.

The existing domain-owned editors remain separate:

- `.../accommodation`
- `.../restaurant`
- `.../tour`
- `.../transport`

They share a Service workspace header, breadcrumb, section navigation, and
read-only presentation, but retain separate DTO/BFF contracts and backend
family checks.

## Roles and ownership

The browser uses the current managed-business membership only to present
controls. NestJS remains authoritative for active user, active membership,
requested business, Service ownership, family compatibility, and deeper
extension ownership.

- OWNER and MANAGER can use generic and compatible specialized editors.
- STAFF can inspect general and specialized details but receives the shared
  **Read-only access** state and no new write controls.
- Inactive members, inactive users, and non-members remain denied server-side.
- A member of Business A cannot manage Business B by altering a URL.

UI hiding is convenience only; backend/business-membership authorization
remains authoritative.

## Generic and specialized data

The generic workspace presents existing Service name, descriptions, category,
pricing model, generic price/currency, duration, status, and booking
configuration. Category-specific prices are not synchronized:

- `Service.price` remains generic/from-price semantics.
- `RoomType.basePrice`, `RestaurantMenuItem.price`, and
  `TransportSchedule.fare` remain domain-specific Decimal catalogue prices.
- Tour retains existing generic Service pricing.

If an existing generic Service category change selects another family, the UI
warns that a different category editor will apply. Existing specialized rows
are preserved; Phase 14F neither deletes nor converts them. Opening a Service
or category editor never auto-creates an extension detail row.

## Security and BFF

The canonical Service BFF stays scoped to the exact business and Service path.
It validates UUIDs, forwards only the HttpOnly server session, uses same-origin
checks for mutations, and rejects unknown PATCH body keys through the existing
strict allowlist helper. Specialized BFF contracts remain separate; there is
no combined arbitrary category body or arbitrary backend proxy.

No access token or refresh token is exposed to browser JavaScript, URLs,
`localStorage`, or `sessionStorage`.

## Responsive and accessible presentation

The shared header provides semantic breadcrumbs, labelled section navigation,
`aria-current` state, visible keyboard focus, text-based Service status and
read-only state, and wrapping controls for narrow screens. The established
Business Portal shell, mobile drawer, top bar, and business selector are
unchanged.

## Boundaries

Phase 14F adds no Prisma schema, seed, or migration work. It does not change
business verification/publication, Service lifecycle, ServiceAvailability,
Booking, Payment, refund, webhook authority, or capacity behavior. It creates
no alternative availability or booking engine.

## Testing

Web coverage verifies the resolver's four fixed family mappings, `OTHER`
behavior, a common primary **Manage Service** entry, canonical authentication,
strict scoped Service BFF handling, shared STAFF presentation, and the absence
of category-code/token-storage dependencies. Existing specialized API
authorization remains the security proof for each domain.

## Deferred work

- Phase 14G public category marketplace/detail completion
- Phase 14H category filtering and regression hardening
- Phase 15 discovery and maps completion
- richer business permission policy only if later requirements need it
- subscriptions and promotions
