# Database Blueprint

## Tables
Identity: users, user_profiles, roles, user_roles, sessions.
Location: regions, cities, destinations, attractions.
Business: businesses, business_members, business_categories, business_locations, business_hours, business_media, business_verifications, verification_documents.
Services: services, service_media, service_availability plus hotel/restaurant/tour/transport extension tables.
Commerce: bookings, booking_items, payments, refunds.
Engagement: reviews, review_media, favorites.
Planning: trips, trip_days, trip_items.
Communication: conversations, conversation_members, messages, notifications.
Platform: reports, subscription_plans, subscriptions, audit_logs.

## Relationships
User 1:M BusinessMember M:1 Business
Business 1:M Location / Media / Service / Booking / Review
Service 1:M Availability / Booking
Booking 1:M Payment
Payment 1:M Refund
User 1:M Trip → TripDay → TripItem
Conversation M:N User; Conversation 1:M Message
Region 1:M City 1:M Destination 1:M Attraction

## Rules
UUID IDs; Decimal/Numeric money; UTC timestamps; foreign keys; indexes; unique slugs; status/soft delete where history matters; transactions for capacity/payment-sensitive changes.
