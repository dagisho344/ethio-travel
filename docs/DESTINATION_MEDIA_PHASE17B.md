# Phase 17B-1: Destination image media backend

Destination images use the existing `MediaAsset` and `DestinationMedia` tables. The canonical Destination remains the owner of publication and location visibility; media does not change destination publication or English/Amharic editorial resolution. Phase 17B-1A added SQL-only migration 25 for the HERO-history invariant; no Prisma model fields changed.

## Admin contract

All routes require an authenticated ADMIN and UUID path parameters under `/api/v1/admin/destinations/:destinationId/media`:

| Method | Suffix | Purpose |
| --- | --- | --- |
| GET | `/` | Paginated image list, including archived items and safe operational metadata |
| POST | `/uploads` | Multipart `file`, `role`, optional `altText` and `caption` |
| GET | `/:mediaId/content` | Authenticated, no-store preview, including archived images |
| PATCH | `/:mediaId` | Update only `altText` and `caption` |
| POST | `/:mediaId/archive` | Archive the image without deleting its record |
| POST | `/reorder` | Supply `mediaIds`: every active gallery image ID exactly once |

Uploads accept JPEG, PNG, or WebP only, up to 10 MiB. Both declared MIME type and file signature must match. SVG, GIF, video, and arbitrary binaries are rejected. Storage keys are generated server-side in `private/destinations/{destinationId}/{mediaId}.{extension}`; original filenames never determine keys. The S3 private bucket holds new Destination objects, and the API streams eligible images through controlled routes. Existing `public/destinations` keys remain readable for compatibility, but new uploads never use them; the current development database had zero legacy Destination objects and attachments at review. Optional alt text is limited to 240 characters and caption to 500, with whitespace-only values stored as null.

Only `HERO` and `GALLERY` roles are valid. A new HERO archives previous non-archived HERO assets in the same database transaction, then becomes the only active cover/card image at sort order zero. A gallery has at most 12 active images. New images receive a deterministic next sort order; reorder rejects duplicate, missing, foreign, HERO, or archived IDs and atomically assigns positions 0 through N−1. DRAFT and PUBLISHED destinations may be edited; ARCHIVED destinations may be inspected but not mutated. Archiving a HERO does not unpublish its Destination.

Migration `20261007000001_destination_active_hero_invariant` replaces the old role-only `destination_media_one_hero` index. PostgreSQL cannot put a joined `MediaAsset.status` predicate in a partial index, so database triggers enforce at most one HERO attachment whose asset status is not `ARCHIVED`. They check both attachment writes and asset-status reactivation while locking the parent Destination row. Archived HERO attachments keep their `HERO` role and remain queryable as history. The service also takes the parent lock during replacement; the trigger protects writes outside that service. Only `READY`/PUBLIC images pass the separate public projection and delivery predicates. The Prisma schema intentionally does not represent these SQL triggers.

Storage upload precedes database attachment. On upload or transactional failure, the new object is deleted on a best-effort basis; committed objects are not removed if only the HTTP response fails. If cleanup itself fails, the original upload/database error remains authoritative and a warning with only Destination/media IDs requests manual remediation; it does not log the storage key or provider error. An orphan may still remain until remediation. Initial upload, HERO replacement, metadata update, archive, and reorder each record one safe Admin audit action in the mutation transaction. HERO replacement audit includes only the previous media ID, not its storage details. Audit metadata contains IDs, role, or gallery count—not image bytes, filenames, captions, alt text, or storage secrets.

## Public contract

The existing controlled `GET /api/v1/media/public/:mediaId` endpoint also serves Destination images only when the asset is READY, PUBLIC, IMAGE, JPEG/PNG/WebP, attached as HERO or GALLERY, and its Destination is PUBLISHED in an ACTIVE City and Region. Ineligible and unattached assets return 404. This endpoint does not accept storage keys. Existing BusinessMedia eligibility is unchanged. Destination delivery uses `no-store` and `nosniff` headers.

Public Destination list responses expose at most one eligible HERO; detail responses expose that HERO and up to 12 eligible GALLERY images in stable order. Each media item includes only its ID, role, sort order, alt text, caption, image MIME/type, and controlled access path. The API does not expose storage keys, uploader IDs, internal asset status, or filenames. Destinations without images remain valid and return an empty hero/gallery representation. Unpublished Destinations remain hidden irrespective of media state.

The Admin destination-media web interface is not part of 17B-1. Future Admin BFF work must forward authenticated preview access without exposing API bearer tokens to browser JavaScript. Destination video is deferred until bounded streaming/range delivery and container validation exist. Destination pricing, booking, Telebirr/CBE, and payment proof are also deferred.

## Verification and remaining UI work

Migration 25 is applied in the local development database; Prisma reports 25 migrations current. The migration is SQL-only and no migration 26 or Prisma model change is required. The opt-in `DESTINATION_MEDIA_DATABASE_TESTS=1` PostgreSQL suite (`pnpm --dir apps/api exec jest --config test/jest-e2e.json --runInBand destination-media.database.e2e-spec.ts`) uses a disposable schema and verifies repeated HERO replacement/history, the database invariant under direct and concurrent writes, transaction rollback/storage cleanup, gallery metadata/order/archive, safe public projection, and persisted audit actions. Final verification: PostgreSQL suite 5/5 passed; API unit suite 45 suites/482 tests passed; affected location HTTP E2E 10/10 passed. The earlier standard HTTP E2E run passed 18 suites/89 tests with 47 tests skipped in six opt-in suites; it was not rerun after the cleanup-warning change. API typecheck/build, changed-file ESLint, targeted Prettier, and Prisma format/validate/generate/status passed. Full API lint still reports four pre-existing unsafe-assignment errors in the Destination-translation spec. Provider unit tests cover the local and S3 destination key namespaces, but no live S3 service was exercised. Public and Admin media routes are backend contracts only: Admin upload/management UI and public Destination HERO/gallery rendering remain future checkpoints. No video upload or delivery is enabled.
