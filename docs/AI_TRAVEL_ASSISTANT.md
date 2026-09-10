# AI Travel Assistant (Phase 11)

## Scope and provider boundary

Phase 11 adds an authenticated, advisory travel assistant. `AiService` owns conversation history, grounding, structured-result validation, usage records, and the explicit suggestion lifecycle. It depends on the `AiProvider` interface rather than a vendor SDK.

Two implementations exist:

- `DISABLED` is the safe default and returns a controlled `503` response.
- `OPENAI_COMPATIBLE` calls a server-side OpenAI-compatible `chat/completions` endpoint with a request timeout and JSON-only response contract.

No AI provider key is available to the web application. The adapter is the only code that constructs a provider `Authorization` header. The domain and Trip Planner layers do not depend on provider-specific SDK types.

## Server configuration

All values are server-only. Do not use `NEXT_PUBLIC_` names for any AI setting.

- `AI_PROVIDER=DISABLED|OPENAI_COMPATIBLE` (default `DISABLED`)
- `AI_BASE_URL` (required for `OPENAI_COMPATIBLE`)
- `AI_API_KEY` (required for `OPENAI_COMPATIBLE`)
- `AI_MODEL` (default `gpt-4o-mini`)
- `AI_REQUEST_TIMEOUT_MS` (1,000?60,000; default 20,000)
- `AI_MAX_OUTPUT_TOKENS` (64?2,048; default 600)
- `AI_REQUESTS_PER_HOUR` (1?100; default 20)

Joi validates these at startup, so a production instance configured to use a provider cannot start with a missing base URL or key. The checked-in `.env.example` contains placeholders only.

## Persistence and ownership

The additive `20260910000001_ai_travel_assistant` migration adds:

- `AiConversation` and bounded `AiMessage` history;
- `AiUsage` with provider/model, optional provider-reported token counts, duration, intent, and success state;
- `AiSuggestion` for validated, pending trip additions.

All foreign keys are restrictive. Conversation and usage history is not hard-deleted by Phase 11. Every API lookup scopes the conversation, suggestion, or trip to the authenticated user; neither the browser nor the model supplies a user identity.

## Data minimization and prompt safety

Only the current user message, explicit non-sensitive preferences, the bounded conversation history, and?when relevant?the owned trip's dates, origin/destination labels, day titles, and itinerary titles are sent to a provider. Public candidate data is bounded to six entities per type and includes public name, category, location, a truncated public description, and authoritative known price only when present.

The assistant never sends password hashes, sessions, access/refresh tokens, payment provider data, verification documents, private business fields, unrelated conversations, or full financial histories. Public descriptions and user input are explicitly treated as untrusted data in the system instruction; they cannot change tool access or application instructions. Prompts and secrets are not logged. Usage logs contain only provider, intent, success, and duration.

## Grounding and structured validation

Candidates are fetched from PostgreSQL with the existing public destination, attraction, business, and service eligibility predicates. The candidate set is the only allowed source of recommendation IDs. The provider must return JSON with a concise summary and recommendations containing `entityType`, `entityId`, reason, and a trip day when a trip is involved.

The server validates every field, limits recommendation count and text lengths, confirms type/ID pairs against the bounded live set, checks day numbers against the actual trip, and discards invalid or hallucinated candidates. Provider JSON that is malformed or has no usable summary returns a controlled invalid-provider response. The web app presents generated reasons as advice, never as platform fact.

Known price values remain separate by currency. Missing prices and `CONTACT_FOR_PRICE` are unknown; no total or FX conversion is fabricated. Recommendations report availability as `UNKNOWN`; they do not reserve inventory. Booking, capacity, payment, refunds, and business eligibility remain exclusively in existing Phase 7/8 flows.

## REST API

All endpoints require the existing bearer JWT and are documented under Swagger tag `ai`.

- `POST /api/v1/ai/conversations`
- `GET /api/v1/ai/conversations?page&limit`
- `GET /api/v1/ai/conversations/:id`
- `POST /api/v1/ai/conversations/:id/messages`
- `POST /api/v1/trips/:tripId/ai/suggestions`
- `POST /api/v1/trips/:tripId/ai/suggestions/:suggestionId/apply`
- `POST /api/v1/trips/:tripId/ai/suggestions/:suggestionId/dismiss`

On provider failure, user and assistant messages are not persisted as a successful exchange. A failed provider call records only a safe failed usage event when possible. AI remains optional; the normal Trip Planner is unaffected.

## Suggestion lifecycle and explicit confirmation

Trip itinerary and trip-improvement actions create `PENDING` suggestions only. They never write TripItems automatically. A traveler can explicitly apply one suggestion. Before apply, the server verifies trip ownership, claims the pending suggestion to prevent concurrent duplicate applies, confirms the trip day still exists, rechecks public eligibility for the live candidate, and calls the existing `TripsService.addItem`. This preserves Phase 10 validation, authorization, archive checks, position handling, and historical rules. Missing/non-public candidates become `INVALID`; rejected or failed applications do not change an itinerary.

Phase 11 currently supports safe **ADD** proposals only. Destructive `REMOVE`, `MOVE`, `REORDER`, and `REPLACE` improvements are intentionally deferred rather than letting a model mutate itinerary history. Existing booking items are read-only context and are never AI-generated or modified.

## BFF and frontend

The Next.js BFF routes are same-origin `/api/ai/...` and `/api/trips/:id/ai/...` proxies. They use `authenticatedBackendJson`, preserve HttpOnly session refresh behavior, clear cookies on 401, and validate the Origin for every mutation. Browser JavaScript never receives an access token, refresh token, or provider key.

- `/assistant` is an authenticated responsive chat workspace with conversation history, plain-text composer, loading/error/unavailable states, and grounded recommendation cards.
- `/trips/:id` includes an AI Trip Assistant panel for itinerary/improvement prompts. Suggestions are visibly separate, with explicit Accept and Ignore controls.
- Recommendation links use the existing public Explore search rather than invented detail routes. Model text is rendered as React text with `whitespace-pre-wrap`; no raw HTML is rendered.

## Rate limiting, caching, and limits

Each user has a server-side hourly AI request limit. Redis provides a counter with expiry when reachable; a bounded per-process fallback preserves a limit during Redis outages. Conversation history, candidates, output tokens, recommendation count, and input fields are bounded. There is no personalized-response cache, and PostgreSQL remains the source of truth. Redis is not required for AI data persistence and is not a recommendation source.

## Current limitations

AI is synchronous, has no notification/job flow, and does not create messages or bookings. There is no provider streaming, no automatic retries for malformed output, no cross-currency estimate, and no claim of availability. Distributed rate limits rely on Redis availability; the fallback is intentionally per-process. Future work may add more explicitly confirmed itinerary operations and provider implementations behind the same interface.