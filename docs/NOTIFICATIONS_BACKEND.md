# In-app notifications — Phase 9B

Notifications are persisted PostgreSQL records, never browser-created and never hard-deleted in Phase 9B. Types cover booking lifecycle, authoritative payment results/refunds, persisted messages, verification decisions, and review moderation.

Authenticated API:

- `GET /api/v1/users/me/notifications` — pagination, `unreadOnly`, type filter, newest first
- `GET /api/v1/users/me/notifications/unread-count`
- `POST /api/v1/users/me/notifications/:id/read`
- `POST /api/v1/users/me/notifications/read-all`

Rows are always scoped by the authenticated recipient. Metadata stays private; responses expose no internal payment, JWT, or verification-document values. Reads are idempotent.

Booking creation and traveler cancellation notify active business members excluding the actor. Business transitions notify the traveler. Payment success/failure comes only from backend/provider processing; webhook event IDs and recipient-specific dedupe keys prevent replay duplicates. Completed refunds notify the traveler. Persisted messages notify other active participants, excluding the sender and inactive business members. Verification decisions notify active owner/manager members. Review moderation notifies its author.

After each notification record persists, the existing authenticated `/messaging` Socket.IO gateway emits `notification.created` only to `user:<recipientUserId>`. PostgreSQL remains authoritative. Redis is not used for notification state and no Socket.IO Redis adapter is configured, so realtime delivery is single-instance.