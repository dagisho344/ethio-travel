-- CreateEnum
CREATE TYPE "TripStatus" AS ENUM ('DRAFT', 'UPCOMING', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED');
CREATE TYPE "TripItemType" AS ENUM ('DESTINATION', 'ATTRACTION', 'BUSINESS', 'SERVICE', 'BOOKING', 'CUSTOM');

-- CreateTable
CREATE TABLE "trips" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "origin_city_id" UUID,
  "destination_city_id" UUID,
  "primary_destination_id" UUID,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "status" "TripStatus" NOT NULL DEFAULT 'DRAFT',
  "notes" VARCHAR(2000),
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "trips_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "trips_date_range_check" CHECK ("start_date" <= "end_date"),
  CONSTRAINT "trips_archive_status_check" CHECK (("status" = 'ARCHIVED' AND "archived_at" IS NOT NULL) OR ("status" <> 'ARCHIVED' AND "archived_at" IS NULL)),
  CONSTRAINT "trips_title_not_blank_check" CHECK (length(btrim("title")) > 0)
);

CREATE TABLE "trip_days" (
  "id" UUID NOT NULL,
  "trip_id" UUID NOT NULL,
  "date" DATE NOT NULL,
  "day_number" INTEGER NOT NULL,
  "notes" VARCHAR(1000),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "trip_days_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "trip_days_day_number_check" CHECK ("day_number" > 0)
);

CREATE TABLE "trip_items" (
  "id" UUID NOT NULL,
  "trip_day_id" UUID NOT NULL,
  "type" "TripItemType" NOT NULL,
  "destination_id" UUID,
  "attraction_id" UUID,
  "business_id" UUID,
  "service_id" UUID,
  "booking_id" UUID,
  "title_snapshot" VARCHAR(180),
  "start_time" VARCHAR(5),
  "end_time" VARCHAR(5),
  "position" INTEGER NOT NULL,
  "notes" VARCHAR(1000),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "trip_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "trip_items_position_check" CHECK ("position" >= 0),
  CONSTRAINT "trip_items_time_format_check" CHECK (("start_time" IS NULL OR "start_time" ~ '^[0-2][0-9]:[0-5][0-9]$') AND ("end_time" IS NULL OR "end_time" ~ '^[0-2][0-9]:[0-5][0-9]$')),
  CONSTRAINT "trip_items_time_range_check" CHECK ("start_time" IS NULL OR "end_time" IS NULL OR "start_time" < "end_time"),
  CONSTRAINT "trip_items_target_check" CHECK (
    ("type" = 'DESTINATION' AND "destination_id" IS NOT NULL AND "attraction_id" IS NULL AND "business_id" IS NULL AND "service_id" IS NULL AND "booking_id" IS NULL) OR
    ("type" = 'ATTRACTION' AND "destination_id" IS NULL AND "attraction_id" IS NOT NULL AND "business_id" IS NULL AND "service_id" IS NULL AND "booking_id" IS NULL) OR
    ("type" = 'BUSINESS' AND "destination_id" IS NULL AND "attraction_id" IS NULL AND "business_id" IS NOT NULL AND "service_id" IS NULL AND "booking_id" IS NULL) OR
    ("type" = 'SERVICE' AND "destination_id" IS NULL AND "attraction_id" IS NULL AND "business_id" IS NULL AND "service_id" IS NOT NULL AND "booking_id" IS NULL) OR
    ("type" = 'BOOKING' AND "destination_id" IS NULL AND "attraction_id" IS NULL AND "business_id" IS NULL AND "service_id" IS NULL AND "booking_id" IS NOT NULL) OR
    ("type" = 'CUSTOM' AND "destination_id" IS NULL AND "attraction_id" IS NULL AND "business_id" IS NULL AND "service_id" IS NULL AND "booking_id" IS NULL AND "title_snapshot" IS NOT NULL AND length(btrim("title_snapshot")) > 0)
  )
);

-- CreateIndex
CREATE INDEX "trips_user_id_created_at_idx" ON "trips"("user_id", "created_at");
CREATE INDEX "trips_user_id_status_start_date_idx" ON "trips"("user_id", "status", "start_date");
CREATE INDEX "trips_origin_city_id_idx" ON "trips"("origin_city_id");
CREATE INDEX "trips_destination_city_id_idx" ON "trips"("destination_city_id");
CREATE INDEX "trips_primary_destination_id_idx" ON "trips"("primary_destination_id");
CREATE UNIQUE INDEX "trip_days_trip_id_date_key" ON "trip_days"("trip_id", "date");
CREATE UNIQUE INDEX "trip_days_trip_id_day_number_key" ON "trip_days"("trip_id", "day_number");
CREATE INDEX "trip_days_trip_id_date_idx" ON "trip_days"("trip_id", "date");
CREATE UNIQUE INDEX "trip_items_trip_day_id_position_key" ON "trip_items"("trip_day_id", "position");
CREATE INDEX "trip_items_trip_day_id_position_idx" ON "trip_items"("trip_day_id", "position");
CREATE INDEX "trip_items_destination_id_idx" ON "trip_items"("destination_id");
CREATE INDEX "trip_items_attraction_id_idx" ON "trip_items"("attraction_id");
CREATE INDEX "trip_items_business_id_idx" ON "trip_items"("business_id");
CREATE INDEX "trip_items_service_id_idx" ON "trip_items"("service_id");
CREATE INDEX "trip_items_booking_id_idx" ON "trip_items"("booking_id");

-- AddForeignKey
ALTER TABLE "trips" ADD CONSTRAINT "trips_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trips" ADD CONSTRAINT "trips_origin_city_id_fkey" FOREIGN KEY ("origin_city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trips" ADD CONSTRAINT "trips_destination_city_id_fkey" FOREIGN KEY ("destination_city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trips" ADD CONSTRAINT "trips_primary_destination_id_fkey" FOREIGN KEY ("primary_destination_id") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trip_days" ADD CONSTRAINT "trip_days_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trip_items" ADD CONSTRAINT "trip_items_trip_day_id_fkey" FOREIGN KEY ("trip_day_id") REFERENCES "trip_days"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trip_items" ADD CONSTRAINT "trip_items_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trip_items" ADD CONSTRAINT "trip_items_attraction_id_fkey" FOREIGN KEY ("attraction_id") REFERENCES "attractions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trip_items" ADD CONSTRAINT "trip_items_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trip_items" ADD CONSTRAINT "trip_items_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "trip_items" ADD CONSTRAINT "trip_items_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
