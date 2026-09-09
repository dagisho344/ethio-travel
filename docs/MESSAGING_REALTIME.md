# Messaging realtime (Phases 9A and 9C)

Socket.IO uses the `/messaging` namespace. The server never accepts a client-supplied user ID, business ID, or membership claim as authorization evidence.

## Browser authentication

The Next.js frontend keeps access and refresh JWTs in HttpOnly cookies. It does not expose either token to browser JavaScript to create a Socket.IO connection.

Instead, browser code makes a same-origin, origin-checked `POST /api/socket-ticket` BFF call. The BFF uses the HttpOnly session server-side to call `POST /api/v1/auth/socket-ticket`. That endpoint returns a distinct JWT with `tokenUse: socket`, the authenticated user/session claims, and a 60-second expiry. It is held only in memory and sent as Socket.IO `auth.socketTicket`.

The gateway verifies the token and accepts that credential only if `tokenUse` is exactly `socket`. Existing non-browser integrations can still use `auth.token: Bearer <access JWT>` or an Authorization bearer header. Access and socket credentials are deliberately separated.

Do not place credentials in URLs, localStorage, sessionStorage, or logs.

## Rooms and events

After authentication, the server joins the socket to server-derived `user:<userId>`. A client sends `conversation.join` with `{ conversationId }`; the server validates active conversation membership and current active business membership before joining `conversation:<conversationId>`.

- Persisted REST-created messages emit `conversation.message.created` to the authorized conversation room after the message transaction commits.
- Persisted notifications emit `notification.created` to the authenticated recipient’s user room after notification persistence.

REST and PostgreSQL remain authoritative. The Phase 9C client deduplicates events by record ID, refetches data after reconnection/window focus, and requests a fresh socket ticket for bounded reconnect attempts.

Realtime remains single-instance: no Socket.IO Redis adapter is configured.