# Messaging and notifications frontend (Phase 9C)

## Routes and BFF

Authenticated pages are `/messages`, `/messages/:conversationId`, and `/notifications`. They redirect unauthenticated visitors to sign in with a relative `returnTo` value.

The Next.js BFF keeps the existing HttpOnly `et_access` and `et_refresh` cookies server-side. Browser code calls only same-origin routes:

- `/api/conversations`, `/api/conversations/:id`, `/api/conversations/:id/messages`, and `/api/conversations/:id/read`
- `/api/notifications`, `/api/notifications/unread-count`, `/api/notifications/:id/read`, and `/api/notifications/read-all`

Every state-changing BFF route validates the request origin, uses `authenticatedBackendJson`, preserves backend authorization status, and refreshes cookies only on the server. No browser code stores an access token or refresh token.

## Realtime authentication

The browser does not receive an access JWT. It first calls same-origin `POST /api/socket-ticket`; the BFF forwards the authenticated request to `POST /api/v1/auth/socket-ticket`. The API creates a separately scoped JWT with `tokenUse: socket` and a 60-second expiry. The ticket is held only in the Socket.IO client’s in-memory auth object, then passed to `/messaging` as `auth.socketTicket`.

The gateway accepts a socket ticket only when its verified `tokenUse` claim is `socket`; regular access-token and non-browser Authorization-header support remain separate. It still derives the user from the verified payload and checks conversation membership before allowing `conversation.join`. The ticket is neither persisted nor placed in URLs, localStorage, or sessionStorage.

The client reconnects with bounded backoff and requests a fresh ticket before each reconnect attempt. It removes all Socket.IO listeners and disconnects on unmount. A window-focus refresh also reconciles missed data. PostgreSQL remains authoritative and the service is still single-instance because no Socket.IO Redis adapter is configured.

## Messaging behavior

The inbox uses server pagination, backend `unreadCount`, last activity, and the read-only `lastMessage` projection. The detail view starts on the most recent backend page and loads older numbered pages on demand because Phase 9A exposes page pagination rather than cursors. Messages are plain React text, so no HTML is rendered. The composer trims input, rejects blank or over-5,000-character messages, disables duplicate submissions, and only displays the persisted REST response. Socket events are deduplicated by message ID.

Viewing a conversation posts `/api/conversations/:id/read`. Realtime inbox updates refetch the authorized backend list rather than inventing unread totals. A receiving message in the active conversation is marked read after receipt.

Travelers can contact publicly listed businesses and message from a booking detail. Business owners/staff use the same `/messages` inbox; backend membership remains the authorization source.

## Notifications

The header bell fetches unread count and five recent notifications, supports individual and all-read operations, and refetches on focus/reconnect. `/notifications` supports newest-first backend pagination, unread/all filtering, type filtering, and individual/all read controls. `notification.created` is deduplicated by notification ID.

`actionUrl` is used only when it is a relative internal URL beginning with one slash and not two. Invalid or external values are ignored, preventing open redirects.

## Responsive behavior

The inbox, notification center, and chat use single-column mobile layouts; the composer remains at the bottom of the chat card, buttons keep accessible focus states, and message alignment is derived from the server-provided sender ID.
