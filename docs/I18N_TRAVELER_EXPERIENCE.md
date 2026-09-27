# English and Amharic traveler experience localization

## Scope

Phase 16D-C localizes fixed English and Amharic interface text for authentication, My Profile, favorites, private reviews, messages, notifications, and the standalone AI Assistant. It builds on the unprefixed URL and `et_locale` HttpOnly-cookie architecture introduced in Phase 16D-A and the public-marketplace catalog from Phase 16D-B.

The phase deliberately does not localize Trip Planner, Trip Budget Planner, Trip Sharing owner controls, bookings, payments, Business Portal, or Admin Portal. Those are later, separately testable stages.

## Catalogs and component pattern

English remains the master catalog at `apps/web/messages/en.json`; Amharic is at `apps/web/messages/am.json` and follows the same keys with the existing English fallback. This phase adds or extends:

- `auth`
- `accountProfile`
- `favorites`
- `travelerReviews`
- `messaging`
- `notifications`
- `assistant`

Server pages use `getTranslations` and client components use `useTranslations`. Dynamic values use named interpolation. Shared locale helpers format UI-only dates and numeric limits with `Intl`, retaining Gregorian calendar behavior and never changing stored timestamps, decimal amounts, or currency codes.

## Preserved security and authorization

- Login, registration, return-to validation, JWTs, and HttpOnly auth cookies are unchanged.
- My Profile continues to call the self-only `/api/account` BFF; it never accepts a caller-supplied user ID.
- Favorites, reviews, messages, notifications, and assistant flows retain their existing same-origin BFF and server-side authorization rules.
- Conversation membership, Socket.IO lifecycle, review moderation, notification delivery, and AI permissions are unchanged.
- No browser token storage was introduced.
- Shared-trip fragment-token handling, no-store/no-referrer/noindex controls, and `/shared-trip#token` behavior are untouched.

## Original-language content policy

Only application-owned labels are translated. Business names, email addresses, phone numbers, review text and moderation notes, message bodies, persisted notification titles/bodies, and AI model input/output remain in their original language. Backend-originated messages with no stable error-code contract are not guessed or machine-translated.

## Automated coverage

The traveler i18n static regression test verifies namespace entries in both catalogs, Ethiopic Amharic labels, localized component hooks, preserved original data rendering, private BFF/token protections, safe return navigation, and shared locale date formatting. Existing authentication, profile, messaging, notifications, reviews, and AI tests continue to assert their security and behavior contracts.

## Manual acceptance checklist

- Switch English/አማርኛ on desktop and mobile, then verify login and registration form labels, validation, loading, and return navigation.
- Edit a profile in both languages, including error, retry, and success states.
- Check favorites, My Reviews, messaging, notifications, and AI Assistant empty/loading/error states in both languages.
- Confirm review text, messages, notification content, business names, and AI content are not automatically translated.
- Check Amharic text wrapping, focus rings, dialogs, account navigation, and small-device layouts.
- Verify realtime message and notification updates while the Amharic UI is active.

## Deferred work

Trip Planner, Trip Budget Planner, Trip Sharing owner interface, booking/payment UI, Business Portal, Admin Portal, email templates, server-generated localized error-code contracts, and optional multilingual marketplace/editorial content remain outside Phase 16D-C.
