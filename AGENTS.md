# EthioTravel Codex Instructions
EthioTravel is an Ethiopia-focused travel discovery, local business marketplace, booking and trip-planning platform.

## Example
Origin: Addis Ababa
Destination: Wolaita Sodo

Travelers discover hotels, restaurants, attractions, tours, transport, rentals, cafes, entertainment, shopping and other local services.

## Actors
1. Traveler
2. Business Owner / Staff
3. Administrator

## Read Before Coding
Read all relevant files in `docs/`.

## Stack
- Next.js + TypeScript + Tailwind CSS
- NestJS + TypeScript
- PostgreSQL + Prisma
- Redis
- Socket.IO
- Object storage/CDN
- OpenStreetMap-compatible maps
- OpenAPI/Swagger

## Architecture
Use a modular monolith initially.
Reuse Business, Service, Location, Media, Booking and Review abstractions.
Do not duplicate entire systems for hotel, restaurant, tour and transport.

## Critical Rules
- Only APPROVED businesses are public.
- SUSPENDED businesses cannot receive new bookings.
- Enforce business ownership/membership server-side.
- Keep booking and payment statuses separate.
- Verification documents are private.
- Use transactions for availability/capacity.
- Never trust frontend payment success.
- Preserve financial/booking history.

## Coding Rules
- TypeScript strict mode; avoid `any`.
- Validate external input.
- Thin controllers; business logic in services/domain layer.
- UUID IDs; Decimal/Numeric money; UTC timestamps.
- Proper foreign keys/indexes.
- Swagger documentation and tests.
- Do not change unrelated modules.

## Work Method
1. Read docs.
2. Inspect existing code.
3. State a short plan.
4. Implement requested scope only.
5. Add migrations/tests.
6. Run lint, typecheck, tests and build.
7. Report changes and remaining risks.

## Order
Foundation → Auth → Users/RBAC → Locations/Destinations → Businesses → Verification → Services → Media → Search → Maps → Favorites → Reviews → Dashboards → Availability → Booking → Payments → Messaging → Notifications → Trip Planner → AI.
