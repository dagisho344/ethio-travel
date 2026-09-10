-- Phase 12B: additive business branch locations and per-location weekly operating hours.
-- Legacy businesses.* location columns remain intact as compatibility fields in this phase.

CREATE TYPE "BusinessLocationStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "BusinessWeekday" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

CREATE TABLE "business_locations" (
  "id" UUID NOT NULL,
  "business_id" UUID NOT NULL,
  "city_id" UUID NOT NULL,
  "destination_id" UUID,
  "label" VARCHAR(120) NOT NULL,
  "address_line_1" VARCHAR(240) NOT NULL,
  "address_line_2" VARCHAR(240),
  "neighborhood" VARCHAR(120),
  "postal_code" VARCHAR(40),
  "latitude" DECIMAL(9,6) NOT NULL,
  "longitude" DECIMAL(9,6) NOT NULL,
  "timezone" VARCHAR(64) NOT NULL DEFAULT 'Africa/Addis_Ababa',
  "is_primary" BOOLEAN NOT NULL DEFAULT false,
  "status" "BusinessLocationStatus" NOT NULL DEFAULT 'ACTIVE',
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "business_locations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "business_locations_label_not_blank" CHECK (length(btrim("label")) > 0),
  CONSTRAINT "business_locations_address_not_blank" CHECK (length(btrim("address_line_1")) > 0),
  CONSTRAINT "business_locations_latitude_range" CHECK ("latitude" >= -90 AND "latitude" <= 90),
  CONSTRAINT "business_locations_longitude_range" CHECK ("longitude" >= -180 AND "longitude" <= 180),
  CONSTRAINT "business_locations_primary_active" CHECK (NOT "is_primary" OR ("status" = 'ACTIVE' AND "archived_at" IS NULL)),
  CONSTRAINT "business_locations_archive_status" CHECK (("status" = 'ARCHIVED' AND "archived_at" IS NOT NULL) OR ("status" <> 'ARCHIVED' AND "archived_at" IS NULL)),
  CONSTRAINT "business_locations_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "business_locations_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "business_locations_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "business_location_operating_hours" (
  "id" UUID NOT NULL,
  "location_id" UUID NOT NULL,
  "day_of_week" "BusinessWeekday" NOT NULL,
  "is_closed" BOOLEAN NOT NULL DEFAULT false,
  "opens_at" CHAR(5),
  "closes_at" CHAR(5),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "business_location_operating_hours_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "business_location_operating_hours_schedule" CHECK (
    ("is_closed" = true AND "opens_at" IS NULL AND "closes_at" IS NULL) OR
    ("is_closed" = false AND "opens_at" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' AND "closes_at" ~ '^(?:[01][0-9]|2[0-3]):[0-5][0-9]$' AND "opens_at" < "closes_at")
  ),
  CONSTRAINT "business_location_operating_hours_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "business_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- Backfill exactly one active primary location for every existing business. No business rows are changed.
INSERT INTO "business_locations" (
  "id", "business_id", "city_id", "destination_id", "label", "address_line_1", "address_line_2", "neighborhood", "postal_code", "latitude", "longitude", "timezone", "is_primary", "status", "created_at", "updated_at"
)
SELECT
  gen_random_uuid(), b."id", b."city_id", b."destination_id", 'Primary location', b."address_line_1", b."address_line_2", b."neighborhood", b."postal_code", b."latitude", b."longitude", 'Africa/Addis_Ababa', true, 'ACTIVE', b."created_at", CURRENT_TIMESTAMP
FROM "businesses" b;

CREATE UNIQUE INDEX "business_locations_business_id_label_key" ON "business_locations"("business_id", "label");
CREATE INDEX "business_locations_business_id_idx" ON "business_locations"("business_id");
CREATE INDEX "business_locations_business_id_status_idx" ON "business_locations"("business_id", "status");
CREATE INDEX "business_locations_city_id_idx" ON "business_locations"("city_id");
CREATE INDEX "business_locations_destination_id_idx" ON "business_locations"("destination_id");
CREATE INDEX "business_locations_latitude_longitude_idx" ON "business_locations"("latitude", "longitude");
CREATE INDEX "business_locations_business_id_is_primary_idx" ON "business_locations"("business_id", "is_primary");
CREATE UNIQUE INDEX "business_locations_one_primary_per_business" ON "business_locations"("business_id") WHERE "is_primary" = true AND "status" <> 'ARCHIVED';
CREATE UNIQUE INDEX "business_location_operating_hours_location_id_day_of_week_key" ON "business_location_operating_hours"("location_id", "day_of_week");
CREATE INDEX "business_location_operating_hours_location_id_day_of_week_idx" ON "business_location_operating_hours"("location_id", "day_of_week");
