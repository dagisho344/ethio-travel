# Architecture
Use a modular monolith.

```text
Next.js Web
    |
REST + WebSocket
    |
NestJS API
├── PostgreSQL / Prisma
├── Redis / Jobs
├── Object Storage / CDN
└── Maps / Email / SMS / Payment providers
```

## Modules
auth, users, locations, destinations, businesses, verification, services, media, search, favorites, reviews, availability, bookings, payments, conversations, notifications, trips, analytics, admin, audit.

Start search with PostgreSQL full-text/trigram. Add OpenSearch only after measured need.
Do not start with microservices.
