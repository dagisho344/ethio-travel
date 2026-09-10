# Business Owner Onboarding (Phase 12A)

## Journey

An authenticated active user can start at **List Your Business**, complete the private draft wizard, and open the resulting business workspace:

```text
List Your Business → Basics → Location → Contact details → Review → Draft → Workspace
```

Unauthenticated visitors are sent to `/login?returnTo=/business/onboarding`. The existing sign-in client accepts only safe internal return targets, so this handoff cannot become an open redirect.

## Routes

- `/business/onboarding` — protected five-step draft wizard.
- `/businesses/manage` — protected list of businesses where the current user has an `ACTIVE` membership.
- `/businesses/manage/:businessId` — protected workspace for one exact business.

The header keeps the entry point outside the primary traveler navigation. Authenticated users see it in their Account menu; unauthenticated users are offered the safe login handoff in the header utility/mobile menu.

## Backend APIs reused

Phase 12A intentionally reuses existing business lifecycle APIs:

- `POST /api/v1/businesses` creates a `DRAFT` business.
- `GET /api/v1/my/businesses` lists only businesses with an active requester membership.
- `GET /api/v1/my/businesses/:businessId` enforces exact-business active membership.
- `PATCH /api/v1/my/businesses/:businessId` is restricted to `OWNER` or `MANAGER` memberships.
- `GET /api/v1/regions`, `GET /api/v1/cities`, `GET /api/v1/regions/:regionSlug/cities/:citySlug/destinations`, and `GET /api/v1/business-categories` provide real selector data.

The private business list/detail responses now include only the current requester's membership role and status. This supports workspace presentation without exposing other members.

## BFF routes

The web app uses same-origin, HttpOnly-cookie BFF routes:

- `GET` / `POST /api/businesses/manage`
- `GET` / `PATCH /api/businesses/manage/:businessId`

Mutation requests validate same-origin before forwarding. The BFF whitelists business profile fields and never forwards an owner/user field. Access and refresh tokens remain server-side in HttpOnly cookies.

## Ownership and RBAC

Business ownership is authoritative in `BusinessMember`, not in client input or a selected global role. Creating a business transactionally creates an `ACTIVE OWNER` membership for the authenticated creator. `BUSINESS_OWNER` exists as a seeded global role for platform-level RBAC, but Phase 12A does not grant it merely to open a draft; member authorization remains the source of truth and avoids duplicate global assignments.

`OWNER` and `MANAGER` can update the existing backend-supported profile fields. `STAFF` can view the workspace but is read-only. Inactive or removed members do not appear in My Businesses and fail workspace authorization server-side.

## Lifecycle, verification, and public visibility

New businesses are always created as:

- business status: `DRAFT`
- verification summary: `NOT_SUBMITTED`
- creator membership: `ACTIVE OWNER`

A draft is not public. Public business discovery remains governed exclusively by the existing predicate: `ACTIVE` business status, `VERIFIED` verification summary, active category, active city/region, and published destination when applicable. Onboarding never submits verification, verifies a business, or publishes it.

The workspace exposes `NOT_SUBMITTED`, `PENDING`, `VERIFIED`, and `REJECTED` state. For `NOT_SUBMITTED`, it explains that private documents and the real submission flow are not available yet; it does not invoke the legacy document-less submission endpoint.

## Wizard and resilience

1. Business basics — name, active category, and description.
2. Location — cascading region → city → optional destination, address, and coordinates.
3. Contact details — optional phone, email, and website.
4. Review — a clear summary before creating the draft.
5. Success — the returned business name, `DRAFT` status, verification state, and workspace link.

The wizard persists only non-sensitive form fields under `ethiotravel:business-onboarding-draft:v1` in browser local storage and removes that value after creation. It never stores authentication credentials, passwords, documents, or secrets.

## Workspace

The Phase 12A workspace shows business identity, membership role, business/verification state, setup checklist, profile/location/contact summary, and real links to existing bookings, payments, and messages. Its checklist is derived from data actually returned by the platform; services, media, and verification are never marked complete unless their existing records/state support that conclusion.

## Deliberately deferred

### Phase 12B

- multi-location architecture
- operating hours
- location management

### Phase 12C

- object storage
- public business media
- private verification documents
- upload/finalize flows
- signed private access
- verification submission/resubmission UI

### Phase 12D

- complete business dashboard
- business KPIs
- service management UX
- review/customer operations
- dashboard polish

Phase 12A also does not implement subscriptions, analytics, media upload, verification-document upload, or any payment-provider integration.
