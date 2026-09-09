# Messaging realtime (Phase 9A)

Clients connect to the Socket.IO namespace `/messaging` with the existing short-lived access JWT, preferably through Socket.IO's `auth` option:

```ts
io(`${apiUrl}/messaging`, {
  auth: { token: `Bearer ${accessToken}` },
});
```

An `Authorization: Bearer <token>` handshake header is also accepted for non-browser clients. Do not place access tokens in URLs, log them, or send a client-supplied `userId`, `businessId`, or membership claim as authorization evidence.

After authentication, a client emits `conversation.join` with `{ conversationId }`. The server checks current conversation membership and, for business members, current active business membership before joining `conversation:<conversationId>`. The server also joins the client to its server-derived `user:<userId>` room.

Persisted REST-created messages emit `conversation.message.created` to the authorized conversation room only after the message transaction commits. Clients must continue to treat REST/database state as authoritative and reload after reconnecting. Phase 9A is single-instance realtime; no Socket.IO Redis adapter is configured.