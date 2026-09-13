# Business Media and Verification (Phase 12C)

## Storage

Business-media and verification services use the server-side `StorageProvider` interface. `LOCAL` provides deterministic development/test filesystem storage. `S3` uses an S3-compatible endpoint and separate public/private buckets. Required server-only settings are `STORAGE_PROVIDER`, `STORAGE_DEVELOPMENT_ROOT`, `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET_PUBLIC`, `S3_BUCKET_PRIVATE`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_FORCE_PATH_STYLE`, `S3_PUBLIC_BASE_URL`, and `S3_SIGNED_URL_TTL_SECONDS`. None is a `NEXT_PUBLIC_` value.

The API generates keys only in these namespaces:
- `public/businesses/<business-id>/<media-id>.<extension>`
- `private/verifications/<business-id>/<document-id>.<extension>`

The local provider rejects every other key and is never exposed as a static directory. `GET /api/v1/media/public/:mediaId` resolves a persisted READY/PUBLIC asset for an ACTIVE, VERIFIED, publicly eligible business. It never accepts a filesystem path or serves a private object.

## Media

Owner and Manager can list, upload, edit, archive, and reorder media at `/api/v1/my/businesses/:businessId/media`; STAFF is read-only and inactive/unrelated users are denied. JPEG, PNG, and WebP are accepted only after MIME and magic-byte validation, at most 10 MB. LOGO/HERO replacement archives its prior asset; galleries are ordered. Public output exposes compact eligible logo/hero metadata and a controlled access path, never a storage key.

Workspace: `/businesses/manage/[businessId]/media`.
Same-origin multipart BFF: `/api/businesses/manage/[businessId]/media`.

## Verification

Lifecycle: `no request or REJECTED -> DRAFT -> PENDING -> APPROVED or REJECTED`. A partial unique index permits one editable DRAFT per business. Required EthioTravel platform evidence is BUSINESS_LICENSE, TAX_DOCUMENT, and OWNER_ID; ADDRESS_PROOF and OTHER are optional. This is platform policy, not legal advice.

Owner/Manager can upload only to DRAFT. PDF, JPEG, and PNG documents are limited to 15 MB and require MIME/signature checks. Executables, HTML, SVG, JavaScript, ZIP, Office/macro formats, and spoofed files are rejected. Replacing DRAFT evidence archives the old record; historical PENDING/APPROVED/REJECTED evidence is immutable.

Submit recomputes completeness, verifies active membership, business ownership, primary active location, and business state, then changes DRAFT to PENDING and the business summary to PENDING. It does not publish the business. The legacy submit endpoint only submits an existing complete DRAFT. Rejection records reviewer/reason/date; correction starts a new DRAFT. Verified businesses cannot start another draft.

Workspace: `/businesses/manage/[businessId]/verification`.
Same-origin BFF: `/api/businesses/manage/[businessId]/verification`.
STAFF can see status but not document metadata or mutation controls.

## Admin, privacy, and limitations

ADMIN-only queue/detail/review/document access uses `/api/v1/admin/business-verifications` and `/api/admin/verifications`. DRAFT evidence is excluded. S3 access is short-lived; local files stream only through the protected admin endpoint. No credentials, storage root, arbitrary key, or permanent private URL is returned.

AI grounding receives public platform data only, never verification names, keys, URLs, contents, owner IDs, tax records, licences, or admin notes. BFF authentication remains HttpOnly-cookie based, mutations enforce same origin, and HTTP logging redacts auth and S3/presigned headers.

Current controls are MIME, size, signature validation and private isolation. Malware scanning/quarantine, thumbnail processing, stale-upload cleanup, and production bucket/CDN/CORS review remain production-hardening work.
