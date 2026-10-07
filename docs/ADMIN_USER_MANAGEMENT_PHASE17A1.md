# Phase 17A-1 — Admin user management

This phase extends the existing protected Admin user list and detail screens. It does not create a new user-status enum, delete user records, add restrictions, or change the Prisma schema.

## API and web architecture

- The Admin API retains `JwtAuthGuard`, `RolesGuard`, and `AdminOnly`. `POST /api/v1/admin/users` creates an account; `PATCH /api/v1/admin/users/:userId` changes only profile, email, and roles. Dedicated `POST .../deactivate` and `POST .../reactivate` actions join the existing suspend/restore actions. UUID parameters and strict DTOs reject unsupported fields.
- The web app uses the existing HttpOnly-session Admin BFF. Mutation routes use the existing same-origin validation and field allowlists. Browser code never receives backend credentials.
- `/admin/users` offers bounded search, status/role filters, pagination, and safe list fields. `/admin/users/new`, `/admin/users/:id`, and `/admin/users/:id/edit` use the established Admin layout. New fixed UI text lives in the matching English/Amharic `adminUsers` catalogs; role/status codes remain canonical in requests.

## Security and lifecycle

- Admin-created accounts use the registration password length policy (8–128 characters), normalize email to lowercase/trimmed form, and hash temporary passwords with Argon2. User, profile, role assignments, and safe audit event are transactional. Passwords and hashes are not returned or audited.
- Role changes and email changes revoke all active target sessions. Name/phone-only edits do not. Suspend and deactivate revoke sessions; restore/reactivate never restore old sessions. The JWT strategy checks session revocation and ACTIVE user status on each guarded request, so previously issued access tokens with revoked sessions are rejected there.
- Status transitions use existing `ACTIVE`, `SUSPENDED`, and `DEACTIVATED` values with compare-and-set updates. Block means suspend; unblock means restore. Deactivation is logical and preserves linked history.
- The API rejects self-suspend, self-deactivation, and self-removal of ADMIN. Mutations that could remove the last active ADMIN serialize on the ADMIN role row and check for another active administrator inside the transaction. The UI also hides self-status actions, but the API is authoritative.
- Audit entries cover creation, profile updates, role changes, suspend/restore, and deactivate/reactivate. Metadata contains identifiers, field names, role names, and status transitions, not credentials or profile snapshots.

## Verification and limits

Focused API unit tests cover password hashing, DTOs, transactions, lifecycle transitions, session policy, and audit data. HTTP E2E tests cover authorization and strict request validation. Web Node tests cover the new routes, BFF protections, interface structure, and catalog parity.

The opt-in PostgreSQL suite in `apps/api/test/admin-users.phase17a.database.e2e-spec.ts` passed 8/8 tests. Run it from `apps/api` with `ADMIN_USERS_DATABASE_TESTS=1 pnpm exec jest --config test/jest-e2e.json --runInBand test/admin-users.phase17a.database.e2e-spec.ts` (set the environment variable using your shell's syntax). It creates a uniquely named temporary PostgreSQL schema, applies the existing 23 migrations there, and drops that schema after testing; the main `public` schema is checked before and after for unchanged user, profile, role, session, audit, and active-Admin counts. Tests verify persisted account/role/audit data, an audit-FK-induced transaction rollback, status and role safety, two-connection concurrent last-Admin transitions in both lock directions, and real JWT/session revocation checks. The suite is skipped unless explicitly enabled. No migration or Prisma schema change is part of 17A-1.

Development browser acceptance passed using a disposable, fully migrated PostgreSQL schema. A temporary Admin-created traveler was edited for name, phone, and permitted roles in English and Amharic; validation and persisted values were checked after reload. The existing block/unblock and deactivate/reactivate flows were exercised and the target restored. The 20-user list page size was exercised with the minimum 18 temporary users needed alongside three seed accounts: page 1 had 20 distinct rows, page 2 had one, and search/status filters reset and updated pagination. Representative desktop and 390px mobile list, form, detail, and dialog views were checked in both locales without page-level overflow. The disposable schema and browser profiles were removed; the public development schema was unchanged.

The destructive last-Admin browser scenario was intentionally not performed against a real Admin account. The opt-in PostgreSQL suite above verifies self-protection, the ACTIVE-plus-ADMIN last-Admin rule, and concurrent removals in both lock directions. A signed-in browser session and product-action restriction behavior are covered separately in the restrictions phase. These checks are development acceptance, not a production deployment test.

Granular restrictions (`BOOKING`, `REVIEW`, `MESSAGING`, `BUSINESS_MANAGEMENT`, `PAYMENT_PROOF_SUBMISSION`) and their enforcement are deferred to Phase 17A-2.
