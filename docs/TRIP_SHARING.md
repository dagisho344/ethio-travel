# Share My Trip — Phase 16C

## Scope

Phase 16C adds optional, revocable, read-only sharing to the existing private
Trip Planner. `Trip` remains owned by one authenticated traveler. Sharing does
not create shared editing, shared budgets, bookings, payments, conversations,
or a new itinerary system.

## Data model and migration

`TripShare` is a one-to-one optional extension of `Trip`.

- `tripId` is unique, so a trip has one current share-link record.
- `tokenHash` is a unique SHA-256 digest stored as `CHAR(64)`.
- `expiresAt` and `revokedAt` describe the current link lifecycle.
- The Trip foreign key is `RESTRICT`; no historical trip, booking, or budget
  record is deleted by sharing.

Migration `20260924000001_trip_share_links` is additive: it creates one table,
two unique indexes, and a restrictive foreign key only.

## Token and URL safety

The API uses the existing `createSecureToken(48)` utility and stores only
`hashToken(token)`. A raw token is returned once after creation or
regeneration and is never returned by owner metadata, persisted in browser
storage, recorded in audit data, or placed in a server request URL.

The copyable link uses a fixed public route and a URL fragment:

```text
/shared-trip#<base64url-token>
```

Fragments are not sent in HTTP requests or referrer headers. The page reads
the fragment once, removes it from browser history, then resolves it through a
fixed same-origin POST BFF route. Public responses use `no-store`,
`no-referrer`, and `noindex` protections.

## Lifecycle

- Only an active JWT-authenticated trip owner can view owner metadata, preview,
  create, alter expiry, regenerate, or revoke a link.
- A live token is never implicitly replaced. `POST /share` only creates a row
  when none exists; regeneration is explicit.
- Regeneration replaces the stored hash, invalidating every prior raw token.
- Revocation is idempotent and marks the current record revoked.
- An expired or revoked record cannot be reactivated by editing expiry; it must
  be explicitly regenerated.
- Archived trips remain owner-readable and revocable, but cannot preview,
  create, edit, or regenerate sharing. Public resolution of archived trips
  always fails.

## Public projection and eligibility

The public resolver never reuses the private Trip Planner projection. It
returns only title, date range, currently public primary destination summary,
day/date ordering, and eligible `DESTINATION`, `ATTRACTION`, `BUSINESS`, or
`SERVICE` item names and optional wall-clock times.

It excludes all IDs, user/profile/contact data, notes, budgets, planned
expenses, booking references, payment/refund details, custom items, media, and
private metadata. Each target is rechecked through the central public
destination, attraction, business, or service predicate at read time. A target
that later becomes suspended, unpublished, inactive, or otherwise ineligible
is omitted.

The resolver batches target lookups by type and limits candidates to 200 in
deterministic day/position order. It returns `truncated: true` instead of
silently claiming the shared itinerary is complete.

This MVP shares all eligible non-booking, non-custom items in that bounded
projection. Per-item selection is intentionally deferred.

## Rate limiting

Public resolution is rate-limited through Redis using only token hashes and a
hashed socket address. Production fails closed with `503` when Redis is
unavailable, preserving cross-instance protection. Development and test use a
process-local fallback only; it is not a production substitute.

## Deferred work

- Per-item share selection
- Shared-trip editing or collaboration
- Shared budgets and expenses
- Booking, payment, messaging, or review actions from a share page
- Public itinerary media/gallery presentation
