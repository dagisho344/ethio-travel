# English and Amharic public marketplace translation — Phase 16D-B

## Scope

Phase 16D-B extends the existing English (`en`) and Amharic (`am`)
localization foundation to public marketplace interface text only. It covers
the home page, public search and map controls, destination/business/service
lists and details, category marketplace pages, public service cards, service
family details, public business media controls, favorites, and published
review controls.

The existing non-prefixed URL and `et_locale` HttpOnly cookie architecture
remain unchanged. The language switcher refreshes the current route, so search
and map query parameters, session state, canonical scoped business and
destination paths, and `/shared-trip#token` handling are preserved.

## Translation boundaries

Translated:

- navigation-adjacent public marketplace labels, buttons, headings, filter
  labels, empty/loading/error states, pagination, map popup labels, and
  accessibility names;
- fixed public service-family headings and lifecycle labels;
- Gregorian date presentation in public review and itinerary/schedule views;
- interface price-model labels, without changing amounts or currencies.

Not translated:

- place names, destination editorial content, business names/descriptions,
  category names, service names/descriptions, menus, itineraries, media
  captions/alt text supplied by owners, reviews, messages, trip content, or
  any other marketplace/user-generated data.

Those values remain in their stored language; this phase neither claims nor
performs machine translation.

## Implementation coverage

English remains the master catalog and Amharic has matching keys with the
existing deep-English fallback. This phase adds the `home`, `discovery`,
`map`, `marketplace`, `publicActions`, `destinations`, `businesses`,
`services`, `publicReviews`, `families`, and `serviceDetails` namespaces.

Server-rendered public pages use `getTranslations`; interactive filters,
maps, cards, media, favorites, and review components use `useTranslations`.
The covered public chrome includes the home page, `/search` list/map controls,
destination/business/service listings, family marketplace pages, public
business and service detail labels, loading states, public media controls,
favorite labels, and review controls. Dynamic marketplace values remain
verbatim data, not translation keys.

## Data, routing, and eligibility

No API contract, Prisma model, migration, seed, search predicate, public
eligibility rule, category code, category family, pagination bound, Booking,
Payment, or ServiceAvailability behavior changes in this phase. Query-key
names such as `regionSlug`, `citySlug`, `destinationSlug`, `pricingModel`, and
`currency` remain stable technical values. Family-specific pages still query
by the database `ServiceCategory.family` discriminator, never a translated
display label or category code.

Public Business and Destination routes remain their existing city-scoped
canonical routes; services remain `/services/[id]`. The map continues to use
the same canonical links and existing clustering, Near Me, filter, and stale
request protections.

The legacy `components/explore/ListingPages.tsx` component is not imported by
an application route and was intentionally not expanded during this focused
route-level rollout. Authenticated workflows, transactional actions, and
portal-specific UI remain a later Phase 16D stage.

## Formatting

Public interface plural messages use ICU catalog entries. Date displays use
the active `en-ET` or `am-ET` locale with the Gregorian calendar and preserve
existing stored UTC/wall-clock semantics. Amounts remain the authoritative
decimal strings and explicit currency codes supplied by the API; localization
does not calculate money or convert currencies.

## Verification and manual checks

Automated coverage verifies catalog parity, localized public marketplace
hooks, translated price-context messaging, stable public query keys and family
filters, canonical route preservation, and existing map/search/security
regressions. Existing account/navigation and shared-trip safety tests remain
in the web suite.

Manual browser acceptance remains required on desktop and narrow mobile
viewports for English and Amharic:

- navigation, search filters, map controls/popups, category pages, and public
  cards do not clip or overflow;
- keyboard, touch, Escape, focus-visible, Account, Others, and language
  controls remain operable;
- `/search?view=map` retains filters after language changes;
- public business media gallery and review controls retain accessible labels;
- `/shared-trip#token` still clears its fragment before resolution.

## Next stage

Later Phase 16D stages may localize authenticated traveler, Business Portal,
and Admin Portal interface text. Translating editorial or business-generated
marketplace content requires separately approved data-model, publication, and
search-indexing design; it is intentionally outside Phase 16D-B.
