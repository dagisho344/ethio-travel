# Business workspace UI (Phase 12E)

## Portal shell

Business-management paths (`/businesses/manage` and descendants) use a route-aware chrome component. It retains the root `RealtimeProvider` and server session snapshot but replaces the marketplace header and footer with the lightweight **EthioTravel Business Portal** top bar. All non-business routes continue to render the existing public header and footer unchanged.

The portal top bar provides EthioTravel branding, a return link to the public marketplace, the existing notification bell, account access, and the existing secure `LogoutButton`. Authentication remains HttpOnly-cookie based; no access token, refresh token, or business ownership input is sent to browser storage or URLs.

## Workspace routes

`/businesses/manage/:businessId/layout.tsx` protects the nested workspace with the existing session gate and wraps all existing business pages in `BusinessWorkspaceShell`:

- Overview
- Profile
- Locations
- Services
- Availability
- Bookings
- Customers
- Messages (global account messaging)
- Reviews
- Payments
- Media
- Verification
- Settings

The shell is navigation and presentation only. Each existing BFF/API call continues to authorize the current active member against the exact business on the NestJS server.

## Sidebar and mobile drawer

On desktop, the workspace has a persistent sidebar with active-route state, an active-membership business switcher, and links to All Businesses and EthioTravel. The switcher uses the existing authenticated `/api/businesses/manage` BFF, which proxies `GET /my/businesses`; it never grants access by client-selected business ID.

On smaller screens, the sidebar becomes an accessible drawer with overlay, close control, `aria-expanded`, `aria-modal`, active links, and Escape-to-close behavior. Existing page-level authorization and error handling remain the source of truth.

## Overview and profile

The overview no longer embeds the long profile form. It uses the existing dashboard endpoint for real operational KPI cards, attention items, captured/reimbursed/net revenue grouped by currency, and a setup checklist derived from actual business, location, service, media, and verification data. It does not create charts, payment-derived estimates, or currency conversions.

The prior profile editor is now on `/businesses/manage/:businessId/profile`. Its region/city/destination cascade, coordinate validation, contact fields, BFF mutation, backend error handling, and OWNER/MANAGER versus STAFF behavior are preserved.

## Availability

`/businesses/manage/:businessId/availability` is a selector only. It lists existing services and their current booking configuration, then routes members to the existing per-service availability editor. It adds no availability model, endpoint, or booking calculation.

## Status and role UX

The shell presents business status and verification separately. Verification links distinguish `NOT_SUBMITTED`, `PENDING`, `VERIFIED`, and `REJECTED`. A suspended-business banner explains that public discovery and new bookings remain blocked while historical operational records remain accessible to active members.

OWNER and MANAGER retain their existing backend-authorized management controls. STAFF can use workspace navigation and existing read surfaces but receives no newly introduced write actions. Inactive/unrelated members remain denied by current BFF/backend rules.

## Deferred work

Phase 12E does not alter Prisma, business membership, booking/payment/verification policy, public visibility predicates, media privacy, subscriptions, payouts, administration, advanced discovery, or Phase 13A.