# Profile Completion

## Scope

The authenticated **My Profile** page is available at `/account`. It builds on
the existing user-profile API and shared Account navigation without changing
the Prisma schema, migrations, Booking, Payment, Refund, or
ServiceAvailability behavior.

## Implemented behavior

- The server page checks for an HttpOnly access or refresh cookie and redirects
  unauthenticated visitors to `/login?returnTo=%2Faccount`.
- The responsive client loads the safe authenticated profile through the
  same-origin `/api/account` BFF and displays first name, last name, read-only
  email, phone, and role labels.
- First name, last name, and phone are the only editable fields. Inputs use
  the existing DTO limits: 100 characters for each name and 32 for phone.
- The form includes loading, retry, validation/error, saving, success,
  discard, and duplicate-submit states. Successful saves refresh the current
  route so server-rendered session chrome can observe the latest safe profile
  data where applicable.

## Reused API and BFF security

The implementation reuses the existing authenticated APIs:

- `GET /api/v1/users/me`
- `PATCH /api/v1/users/me`

The new fixed-path BFF is `/api/account`:

- It authenticates with `authenticatedBackendJson`, which forwards only the
  HttpOnly access/refresh cookies server-side and refreshes cookies when the
  existing session flow requires it.
- `PATCH` calls `validateSameOrigin`.
- Its body allowlist is strictly `firstName`, `lastName`, and `phone`; unknown
  keys, objects, arrays, non-text values, and over-limit values are rejected
  before forwarding.
- It never accepts a caller-supplied user ID and always forwards to the fixed
  backend path `/users/me`. The backend derives the target user from the JWT
  subject and returns `SafeUser` only.
- `401` responses clear stale cookies at the BFF boundary. Browser code never
  receives or stores access or refresh tokens.

## Profile photo decision

`UserProfile.avatarUrl` exists in the historic DTO/model, but no verified user
profile upload, ownership, file-validation, or public/private media policy is
implemented for it. `/account` therefore uses a neutral initials avatar and
does not expose an external URL field or an upload control. Profile-photo
upload is deferred until a dedicated safe upload design is available.

## Deferred capabilities

No complete existing API/BFF flow supports changing a password from the
profile page, viewing/revoking sessions, changing email, or account
deactivation. These controls are intentionally not presented. Each requires
its own authenticated policy, mutation route, validation, and regression
coverage.

## Tests

Focused coverage verifies the login handoff, account BFF fixed self-only path,
same-origin mutation protection, field allowlist/limits, cookie handling,
token non-exposure, loading/retry/error/success states, duplicate prevention,
and Account-dropdown Profile link. The API E2E profile test additionally
asserts that the controller forwards the authenticated JWT subject—not a body
user ID—and rejects an attempted supplied `userId` field.
