# English and Amharic localization foundation — Phase 16D-A

## Scope

Phase 16D-A localizes only shared EthioTravel application chrome. It adds
English (`en`) and Amharic (`am`) infrastructure, navigation, account-menu,
footer, portal-header, and language-switcher translations. Existing page
content intentionally remains English until later localization phases.

This phase does not translate marketplace, business-owner, editorial, or
user-generated content. Names, descriptions, menus, itineraries, reviews,
messages, trip notes, and payment/booking records remain in their stored
source language.

## Architecture and dependency

The web workspace uses `next-intl` 4.14.6 with its non-prefixed App Router
request configuration. Existing URLs remain canonical: no `/en` or `/am`
prefixes, locale middleware, redirects, or route rewrites are introduced.

`apps/web/i18n/request.ts` resolves messages for Server Components. The root
layout provides the selected catalog through `NextIntlClientProvider`, so
Client Components use the same locale. English is the master catalog in
`apps/web/messages/en.json`; `am.json` has matching keys. The message loader
deep-merges Amharic with English, so an accidentally missing Amharic leaf has
an explicit English fallback rather than a missing-key placeholder.

Catalogs support ICU interpolation and pluralization. Translation keys are
namespaced by chrome concern (`navigation`, `account`, `locale`, `footer`, and
`portal` in this phase). New UI must reuse a namespace and must not use
translated display text for routes, authorization, enums, category codes, or
other program logic.

## Locale resolution and cookie security

The default locale is English. A valid server-readable `et_locale` cookie
selects `en` or `am`; missing or invalid values resolve to `en`.

`POST /api/locale` is a fixed same-origin route. It accepts exactly one field,
`locale`, and allowlists only `en` and `am`. It validates `Origin` using the
existing BFF helper and writes a cookie with:

- `HttpOnly`
- `SameSite=Lax`
- `Path=/`
- `Secure` in production
- a one-year maximum age

The browser cannot write the cookie directly. No Accept-Language automatic
selection, account database preference, JWT claim, URL locale, or middleware
is introduced in this stage. Switching calls the fixed route and uses
`router.refresh()`, preserving the current pathname, search/map query
parameters, authenticated session, and navigation state.

## Rendering and formatting

The root HTML element receives the active `lang` value and always keeps
`dir="ltr"`; Amharic uses Ethiopic script but is not RTL. The global font stack
uses Ethiopic-capable system fallbacks without downloading font binaries.

`apps/web/i18n/format.ts` provides future locale-aware number, Gregorian date,
and decimal-string money display helpers. It does not change API values,
stored Decimal values, UTC timestamps, wall-clock itinerary times, booking
semantics, currencies, or exchange-rate behavior. The money helper does not
convert decimal strings to JavaScript floating point values.

## Shared chrome coverage

Translated now:

- public desktop and mobile navigation, including Others;
- guest Sign In and Join EthioTravel actions;
- signed-in Account and mobile Account navigation labels;
- logout and logout-loading labels;
- public footer;
- shared Admin and Business portal header labels;
- desktop and mobile language controls and accessibility names.

Not yet translated: individual public pages, search/map filters and popups,
authentication forms, account page content, trips, bookings, payments,
messaging, notifications, AI Assistant, Business Portal forms, and Admin
Portal page content. Those remain intentionally English for later scoped work.

## Routing and security compatibility

All existing application URLs remain unchanged, including `/search`,
`/search?view=map`, scoped public Business/Destination routes, login
`returnTo`, and authenticated BFF paths. Authentication cookies and all
same-origin BFF protections remain unchanged.

Trip sharing remains especially protected. `/shared-trip#token` is not
redirected or rewritten. The existing client removes the fragment immediately
and posts it only to the fixed same-origin resolver. Locale selection does not
place tokens in cookies, URLs, logs, analytics, localStorage, or
sessionStorage. The shared-trip page retains its `noindex`, `no-store`, and
`no-referrer` protections.

## Tests and manual checks

The Phase 16D-A tests cover catalog key parity, English master strings,
Amharic labels, cookie settings and fallback source, strict locale-route
validation, same-origin protection, in-place refresh behavior, desktop/mobile
language controls, HTML language/LTR output, and shared-trip fragment safety.

Manual browser checks still required after deployment/testing access:

- English and Amharic labels on desktop and narrow mobile widths;
- keyboard, touch, Escape, outside-click, and focus behavior for language,
  Others, and Account controls;
- query retention on `/search?view=map` and filtered search routes;
- login return navigation after a locale selection;
- `/shared-trip#token` resolution before and after changing locale elsewhere;
- Ethiopic system-font rendering on supported Android, iOS, and desktop
  browsers.

## Next stage

Phase 16D-B may translate public discovery and marketplace UI labels only.
Multilingual editorial, business, and search content require separately
approved data-model and indexing work. Cross-device account language
preference also requires a separate additive `UserProfile` preference-field
migration; it is not part of this phase.
