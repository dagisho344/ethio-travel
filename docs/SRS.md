# SRS — Codex Edition

## Goal
A traveler chooses an origin and destination and discovers complete information about verified local businesses/services at the destination.

## Actors
Traveler; Business Owner/Staff; Administrator.

## Core Requirements
### Auth
Registration, login/logout, session/refresh, password reset, profile, RBAC.

### Destinations
Regions, cities, destinations, attractions, origin/destination search, destination detail.

### Businesses
Business registration; complete profile; contacts; GPS/location; hours; services; photos/videos; members; verification lifecycle:
DRAFT → PENDING_VERIFICATION → APPROVED / REJECTED; SUSPENDED when required.
Only APPROVED businesses are public.

### Services
Common service model with category-specific extensions for hotels, restaurants, tours and transport.

### Discovery
Keyword/location search, filters, sorting, list/map, Near Me.

### Engagement
Favorites, reviews/ratings, reporting/moderation.

### Booking
Availability, transactional capacity, booking lifecycle, cancellation.

### Payments
Provider abstraction, server-side verification, refunds, no raw card storage.

### Communication
Traveler-business messaging and notifications.

### Trip Planner
Trips, days, itinerary items, budget/interests, future recommendations.

### Dashboards
Traveler, Business and Admin dashboards.

## Non-Functional
Mobile-first; localization-ready; accessible; secure; observable; backed up; modular and testable.
