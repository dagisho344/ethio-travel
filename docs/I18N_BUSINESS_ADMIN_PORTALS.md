# English and Amharic Business and Admin Portal localization — Phase 16D-E

## Scope

Phase 16D-E extends the established non-prefixed, cookie-selected `next-intl`
foundation to fixed Business Portal and Admin Portal interface text. English
remains the master catalog and Amharic contains matching translation keys with
the existing English leaf fallback. Both languages remain left-to-right.

This presentation-only pass does not change routes, API contracts, database
values, category codes, category families, authorization, BFF behavior, or
business logic.

## Catalogs and rendering pattern

The work extends `apps/web/messages/en.json` and `apps/web/messages/am.json`
with these namespaces:

- `businessPortal` for workspace navigation, dashboard, service operations,
  availability, customers, reviews, media-related chrome, and read-only cues;
- `businessOnboarding` for the private business-draft wizard; and
- `adminPortal` for secure administration navigation, dashboards, analytics,
  settings, reports, moderation, and common investigation labels.

Client components use `useTranslations`; protected server pages use
`getTranslations`. Dynamic business names, customer names, review text,
report reasons, and other stored content remain verbatim data, not translation
keys.

## Business Portal coverage

Translated shared Business Portal navigation includes the desktop sidebar,
mobile drawer, business switcher label, verification summary, suspension
notice, and account-adjacent portal chrome. The onboarding page and wizard,
My Businesses flow, business dashboard, profile/settings, locations/hours,
media and verification controls, service creation/listing, availability index,
business bookings/payments, customers, and business-review response interface
use translated application-owned labels, instructions, validation, loading,
empty, and read-only states.

The existing server-side active-member, OWNER/MANAGER/STAFF behavior remains
authoritative. Localized presentation does not change BusinessMember lookup,
service-family routing, availability controls, review-response authorization,
or business/publication lifecycle behavior.

## Admin Portal coverage

Translated Admin navigation preserves the existing route structure and mobile
drawer/Escape behavior. The dashboard, users list, audit log, report queue,
moderation summary, booking/payment investigation lists, analytics, and typed
platform-settings UI use translated fixed labels and known frontend-owned
fallback messages.

Admin actions, verification decisions, suspension/restoration, publication
transitions, report/review lifecycle commands, audit metadata, and platform
settings allowlists remain unchanged. Backend-originated arbitrary errors are
not guessed or machine-translated.

## Financial, privacy, and formatting safeguards

- Business revenue and Admin analytics use `formatLocaleMoney` for display of
  authoritative decimal strings and ISO currency codes. Currency groups remain
  separate; no exchange conversion or JavaScript floating-point financial
  calculation was introduced.
- Dates rendered by newly localized customers, reviews, audit entries, and
  settings use the established Gregorian locale formatter. Stored timestamps
  and date-only values are not changed.
- Verification documents, private media paths, payment/provider credentials,
  customer accounts, audit metadata, report text, and browser auth tokens are
  not exposed by this localization work.

## Verification

`apps/web/tests/i18n-business-admin-portals.test.mjs` checks English/Amharic
key parity, Ethiopic catalog values, localized shared portal shells, protected
API paths, decimal-safe financial presentation, and continued use of existing
onboarding/service/review controls. Existing portal tests continue to cover
same-origin BFFs, membership/role boundaries, service-family routing,
payments, moderation, reports, and settings restrictions.

Manual browser acceptance remains required:

- English and Amharic desktop and narrow-mobile Business onboarding, business
  switcher, profile/location/media forms, service family editors, availability,
  bookings, customers, reviews, and payments;
- English and Amharic Admin drawer navigation, verification, businesses/users,
  destination/category screens, moderation/reports, booking/payment
  investigations, analytics, audit, and settings;
- keyboard focus, Escape dismissal, visible focus rings, Amharic wrapping, and
  horizontal-overflow checks; and
- confirmation that role-specific controls and server authorization remain the
  same after switching language.

## Deferred work

This phase does not translate business-owner content, destination editorial
content, restaurant menus, tour itineraries, review bodies, messages,
moderation notes, audit metadata, or persisted notifications. Stable localized
backend error-code contracts should be separately scoped; arbitrary
backend-originated error text remains verbatim rather than being guessed or
machine-translated.

## Final coverage matrix

| Surface | Fixed application chrome | Remaining fixed English UI |
| --- | --- | --- |
| Business shell, onboarding, profile, settings, locations, media, verification, availability, operations | Fully localized fixed interface | Stored values and arbitrary backend errors remain verbatim by design. |
| Generic Service workspace | Fully localized headings, help text, validation feedback, booking cue, read-only fields and category-editor warning | Category display names, pricing-model enum values and owner-entered Service content remain original data. |
| Accommodation editor | Fully localized helper copy, form fields, validation feedback, lifecycle controls and compact room summary | Room names and descriptions remain original owner content. |
| Restaurant editor | Fully localized detail/menu/menu-item fields, placeholder, validation feedback, empty states and lifecycle controls | Cuisine values, menu names and item content remain original owner content. |
| Tour editor | Fully localized detail/itinerary fields, validation feedback, controls and empty states | Itinerary titles, descriptions, inclusions and exclusions remain original owner content. |
| Transport editor | Fully localized route/schedule fields, boundary explanation, validation feedback, summary and lifecycle controls | City names and operator-entered values remain original data. |
| Admin list/dashboard/analytics/settings/reports/moderation | Localized where changed in this phase | Existing backend-originated errors remain verbatim. |
| Admin Business/User details | Loading, navigation, count cards, memberships and verification/location headings localized | Status enum values, record-derived summaries, and selected detail metadata remain unchanged by design. |
| Admin verification, booking, payment, report and review details | Fully localized fixed loading, error, action, confirmation-dialog and safe-field chrome | Status enum values and record-derived summaries remain unchanged by design. |
| Admin destination editor | Fully localized creation/edit labels, publication confirmation, coordinate label, loading and frontend fallback errors | Destination name and editorial descriptions remain original CMS content. |

No fixed English UI remains in the surfaces enumerated above. This claim does
not include dynamic database content, technical enum values, or arbitrary
backend error messages. Translation changes do not alter server-side
authorization, request payloads, lifecycle transitions, financial values,
audit records, or private document/media access.
