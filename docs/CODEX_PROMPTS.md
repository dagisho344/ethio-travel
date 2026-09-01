# Ready-to-Use Codex Prompts

## Analyze First
Read `AGENTS.md` and every file under `docs/`. Do not write code. Identify contradictions, missing requirements, unsafe assumptions, database risks and architecture problems. Return prioritized findings.

## Foundation
Implement Phase 0 only according to `AGENTS.md`, `docs/ARCHITECTURE.md` and `docs/ROADMAP.md`. Create the monorepo, Next.js web, NestJS API, Prisma/PostgreSQL, Redis config, environment validation, Swagger, structured logging, linting, typecheck, tests/build and CI. Do not implement product modules.

## Authentication
Implement Auth + Users/RBAC only. Add Prisma models/migration, registration, login, secure password hashing, refresh/session rotation, logout, profile endpoints, validation, Swagger and tests.

## Locations
Implement Region, City, Destination and Attraction modules with Prisma migration, indexes, slugs, public read APIs, admin CRUD, validation, Swagger and tests.

## Business
Implement business draft onboarding, members, locations, contacts, hours and media metadata. Enforce authorization. Do not expose unapproved businesses publicly.

## Verification
Implement DRAFT → PENDING_VERIFICATION → APPROVED/REJECTED plus SUSPENDED. Keep documents private. Add admin decisions, reasons, audit logs, notifications hooks and tests.

## Completion Report
After each task report: implemented work; changed files; migrations; endpoints; tests/results; security notes; remaining TODOs.
