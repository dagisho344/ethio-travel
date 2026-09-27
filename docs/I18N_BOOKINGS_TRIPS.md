# English and Amharic bookings and trips localization

## Scope

Phase 16D-D localizes fixed traveler-facing interface text for the existing
booking, payment, Trip Planner, Trip Budget, and Trip Sharing interfaces. It
uses the established unprefixed App Router locale architecture from Phase
16D-A: the server-readable `et_locale` cookie selects either English (`en`) or
Amharic (`am`), and both languages remain left-to-right.

No routes, APIs, authorization rules, database values, Prisma schema, or
migrations change in this phase.

## Catalogs and implementation pattern

English remains the master catalog in `apps/web/messages/en.json`; Amharic in
`apps/web/messages/am.json` has matching keys and retains the existing English
fallback. This phase adds these namespaces:

- `bookings`
- `payment`
- `trips`
- `tripBudget`
- `tripSharing`

Client components use `useTranslations`; protected server pages use the
existing server translation pattern. Static status and category identifiers
are mapped to display-only translation keys. They are never used as API,
database, authorization, or route values.

## Booking and payment safeguards

- Booking and payment status values remain separate. Translation only changes
  their presentation labels.
- Booking creation, availability checks, cancellation, return-to handling,
  idempotency, payment-provider authority, refund state, and same-origin BFF
  behavior are unchanged.
- Money is still authoritative decimal-string data. Presentation uses
  `formatLocaleMoney`; no floating-point financial calculation or currency
  conversion was introduced.
- Dates use the established locale-aware formatter without changing stored UTC
  timestamp values.

## Trip Planner and budget safeguards

- Trip calendar dates use `formatLocaleCalendarDate`, which formats the
  existing `YYYY-MM-DD` values with the Gregorian calendar and does not alter
  date-only semantics.
- Stored trip titles, day notes, custom item titles, business names, service
  names, and other user or marketplace content remain in their original
  language.
- Existing active-user ownership checks, archive read-only behavior, owned-trip
  selection, duplicate-submission protections, and BFF routes are unchanged.
- Trip Budget category enum values remain unchanged. Only their display labels
  are localized.
- Planned totals, remaining/over-budget calculations, the 100-expense limit,
  currency restriction, and transactional behavior are unchanged.
- Attached booking subtotals remain visibly separate from planned expenses and
  remain excluded from remaining-budget calculations.

## Trip Sharing compatibility

Trip Sharing remains a separate, read-only public projection. Owner controls
and the public page localize only fixed labels. Shared itinerary titles,
destination names, item names, and wall-clock times remain original content.

The raw high-entropy token remains exclusively in `/shared-trip#token` until
the client removes the fragment with `history.replaceState`. Resolution still
uses the fixed same-origin POST route. No token is placed in a locale cookie,
query string, persistent browser storage, logs, or analytics. Existing
no-store, no-referrer, and noindex protections remain in force.

## Automated coverage

`apps/web/tests/i18n-bookings-trips.test.mjs` verifies:

- English/Amharic namespace key parity and Ethiopic labels;
- localized booking/payment controls alongside existing secure availability,
  booking, and idempotent-payment request paths;
- localized calendar-date and money presentation without altering trip or
  budget domain data;
- archived-trip, owned-trip, duplicate-submission, and separate booking-total
  regression cues; and
- fragment-only, storage-free Trip Sharing behavior and public privacy
  boundaries.

Existing booking, payment, Trip Planner, Trip Budget, Trip Sharing, account,
and localization tests continue to cover the relevant security and behavior
contracts.

## Remaining untranslated work

Business Portal and Admin Portal page interfaces, email/notification templates,
stable backend error-code localization, and marketplace/editorial content are
outside this phase. Phase 16D-D does not translate user-generated or
business-owner-generated content.

## Manual acceptance checklist

- Check Booking list/detail, availability, and payment states in English and
  Amharic on desktop and a narrow mobile viewport.
- Create, edit, reorder, archive, and revisit a trip while verifying Amharic
  wrapping, focus states, and Gregorian date presentation.
- Add, edit, and remove planned expenses; verify ETB and other ISO currency
  codes display without conversion and booking subtotals stay separate.
- Verify an archived trip stays read-only in both languages.
- Create, copy, regenerate, revoke, and open a share link. Confirm the token
  fragment clears immediately, the shared page does not reveal private trip or
  budget content, and language switching does not add the token to a URL.
