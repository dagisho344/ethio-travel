# Public Business Media Completion

## Scope

This change completes traveler-facing business media using the existing
`Business`, `BusinessMedia`, `MediaAsset`, storage, and public business
contracts. It does not change Prisma, media storage namespaces, verification,
Booking, Payment, Refund, or ServiceAvailability behavior.

## Root causes

- The canonical public business detail projection selected only `LOGO` and
  `HERO`, so uploaded `GALLERY` images could never reach the traveler page.
- The detail and service-card UI appended an access path beginning with
  `/api/v1` to `NEXT_PUBLIC_API_URL`, which already contains `/api/v1` in the
  supported configuration. That produced a duplicated path rather than an
  image URL.
- Existing public cards used placeholders or media text links instead of the
  actual eligible business image.

## Safe API contract

The public business list continues to select only an optional ready/public
hero and logo. The scoped public business detail route additionally performs a
separate, bounded gallery query:

- maximum 12 gallery assets;
- deterministic `sortOrder ASC, createdAt ASC` ordering;
- `READY` and `PUBLIC` assets only;
- the same centrally eligible active, verified business predicate as the
  business detail itself.

Keeping that gallery query separate means a large gallery cannot displace the
one eligible logo or hero. List, Search, and Map responses do not receive a
gallery tree.

Every returned media item contains only `id`, optional `altText`, optional
`caption`, and the controlled `accessPath`
`/api/v1/media/public/:mediaId`. It never contains a storage key, local path,
private object URL, verification file, membership record, audit data, booking,
or payment information.

`GET /api/v1/media/public/:mediaId` remains the only byte-delivery path. It
revalidates asset readiness/public visibility and central business/location/
destination eligibility before streaming the object with its stored image MIME
type, `Content-Length`, and `X-Content-Type-Options: nosniff`.

## Traveler UI

- The business detail has a responsive HERO cover, a distinct LOGO next to the
  business name, and a responsive gallery with optional captions.
- Gallery images load lazily, hide gracefully after an image error, and open in
  a keyboard-accessible viewer with a close control and Escape dismissal.
- Public business and service cards now use a real compact hero/logo thumbnail
  when available, while retaining their graceful no-media layout.
- `publicMediaUrl` resolves the absolute-path API contract with `new URL`, so
  local and deployed API bases do not duplicate `/api/v1` or expose storage
  paths.

Favorites, Add to Trip, messaging, canonical scoped business links, reviews,
and existing public eligibility remain unchanged.

## Owner media lifecycle

Owner and Manager uploads already validate JPEG/PNG/WebP bytes and sizes.
Replacing a LOGO or HERO archives its previous `MediaAsset`; gallery insertion
uses the next deterministic sort order and the existing reorder command. The
public projection excludes archived, pending, failed, and private assets.

## Tests and manual checks

Focused API tests cover logo/hero replacement, gallery ordering, bounded
eligible gallery selection, private-field exclusion, and controlled image
delivery headers. Web tests cover URL composition, cover/logo/gallery
rendering, card thumbnails, lazy/error behavior, keyboard viewer support, and
token/storage-key non-exposure.

Manual browser checks remain appropriate for an uploaded image of each role:
desktop/mobile cover proportions, logo containment, gallery viewer, broken
image fallback, and API image content type in the network inspector.
