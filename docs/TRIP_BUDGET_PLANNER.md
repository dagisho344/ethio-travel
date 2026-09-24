# Trip Budget Planner — Phase 16B

## Scope

Phase 16B adds a private budget plan to an authenticated traveler's existing
Trip Planner. It does not alter Booking, Payment, Refund, or
ServiceAvailability state machines.

## Data model

`TripBudget` is an optional one-to-one extension of `Trip` with a positive
Decimal amount and a single ISO 4217 currency. `TripPlannedExpense` belongs to
that budget and is categorized as Accommodation, Transport, Food, Activities,
or Other. Expense amounts inherit the budget currency; no exchange-rate or
cross-currency conversion is created.

The migration `20260923000001_trip_budget_planner` is additive: one enum, two
new tables, indexes, and restrictive foreign keys. Existing Trips, Bookings,
Payments, Refunds, and availability records are untouched.

## Authorization and immutability

Every API operation derives the traveler from the JWT, checks that the user is
active, scopes the Trip by `{ id, userId }`, and returns not found for an
unowned Trip. Budget mutations use the existing archived-trip guard. Archived
budget data remains readable but is read-only.

The BFF uses fixed backend paths, UUID validation, strict body allowlists,
same-origin mutation checks, and the existing HttpOnly session-forwarding
helper. Tokens are not exposed to browser state.

## Totals and booking separation

The server uses `Prisma.Decimal` and serializes money as strings. It returns
category totals, planned total, remaining amount, and an explicit over-budget
indicator. A maximum of 100 planned expenses is enforced inside a serializable
transaction.

The existing `estimatedBookingCost` remains authoritative Booking-subtotal
context. It is displayed separately and is never added to planned-expense
totals or remaining-budget calculations, preventing double counting. Mixed or
unknown Booking currencies remain uncombined.

## UI and lifecycle

The Trip detail page provides a responsive Budget section with overall budget,
category totals, expenses, editing, remove controls, loading/error protection,
and duplicate-submit disabling. Removing a budget requires confirmation and
deletes only that private budget and its planned expenses transactionally.

Changing a budget currency is rejected while planned expenses exist; the user
must remove those plans first, so values are never silently reinterpreted.

## Deferred work

No FX conversion, shared budgets, receipt uploads, payment controls, booking
creation, or automatic expenditure import is included.
