-- CreateEnum
CREATE TYPE "BookingMode" AS ENUM ('DATE', 'DATE_RANGE', 'TIME_SLOT');
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED_BY_TRAVELER', 'CANCELLED_BY_BUSINESS', 'COMPLETED', 'NO_SHOW');
CREATE TYPE "PaymentStatus" AS ENUM ('NOT_REQUIRED', 'UNPAID', 'PENDING', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED', 'FAILED');
CREATE TYPE "AvailabilityOverrideType" AS ENUM ('BLOCKED', 'CAPACITY');

-- CreateTable
CREATE TABLE "service_booking_configs" (
  "id" UUID NOT NULL,
  "service_id" UUID NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "booking_mode" "BookingMode" NOT NULL DEFAULT 'TIME_SLOT',
  "timezone" VARCHAR(80) NOT NULL DEFAULT 'Africa/Addis_Ababa',
  "capacity" INTEGER NOT NULL DEFAULT 1,
  "min_quantity" INTEGER NOT NULL DEFAULT 1,
  "max_quantity" INTEGER NOT NULL DEFAULT 1,
  "min_duration_minutes" INTEGER,
  "max_duration_minutes" INTEGER,
  "advance_notice_minutes" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "service_booking_configs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "service_booking_configs_capacity_check" CHECK ("capacity" > 0),
  CONSTRAINT "service_booking_configs_quantity_check" CHECK ("min_quantity" > 0 AND "max_quantity" >= "min_quantity"),
  CONSTRAINT "service_booking_configs_duration_check" CHECK (("min_duration_minutes" IS NULL OR "min_duration_minutes" > 0) AND ("max_duration_minutes" IS NULL OR "max_duration_minutes" > 0) AND ("min_duration_minutes" IS NULL OR "max_duration_minutes" IS NULL OR "max_duration_minutes" >= "min_duration_minutes")),
  CONSTRAINT "service_booking_configs_notice_check" CHECK ("advance_notice_minutes" >= 0)
);

CREATE TABLE "service_availability_rules" (
  "id" UUID NOT NULL,
  "service_id" UUID NOT NULL,
  "weekday" INTEGER NOT NULL,
  "start_time" VARCHAR(5) NOT NULL,
  "end_time" VARCHAR(5) NOT NULL,
  "capacity" INTEGER NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "valid_from" DATE,
  "valid_until" DATE,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "service_availability_rules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "service_availability_rules_weekday_check" CHECK ("weekday" >= 0 AND "weekday" <= 6),
  CONSTRAINT "service_availability_rules_time_check" CHECK ("start_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "end_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' AND "start_time" < "end_time"),
  CONSTRAINT "service_availability_rules_capacity_check" CHECK ("capacity" > 0),
  CONSTRAINT "service_availability_rules_valid_range_check" CHECK ("valid_from" IS NULL OR "valid_until" IS NULL OR "valid_from" <= "valid_until")
);

CREATE TABLE "service_availability_overrides" (
  "id" UUID NOT NULL,
  "service_id" UUID NOT NULL,
  "start_at" TIMESTAMP(3) NOT NULL,
  "end_at" TIMESTAMP(3) NOT NULL,
  "type" "AvailabilityOverrideType" NOT NULL DEFAULT 'BLOCKED',
  "capacity" INTEGER,
  "reason" VARCHAR(300),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "service_availability_overrides_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "service_availability_overrides_range_check" CHECK ("start_at" < "end_at"),
  CONSTRAINT "service_availability_overrides_capacity_check" CHECK (("type" = 'BLOCKED' AND "capacity" IS NULL) OR ("type" = 'CAPACITY' AND "capacity" IS NOT NULL AND "capacity" >= 0))
);

CREATE TABLE "bookings" (
  "id" UUID NOT NULL,
  "reference" VARCHAR(32) NOT NULL,
  "service_id" UUID NOT NULL,
  "business_id" UUID NOT NULL,
  "traveler_id" UUID NOT NULL,
  "start_at" TIMESTAMP(3) NOT NULL,
  "end_at" TIMESTAMP(3) NOT NULL,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "guest_count" INTEGER,
  "unit_price" DECIMAL(12,2),
  "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "currency" CHAR(3),
  "pricing_model_snapshot" "PricingModel" NOT NULL,
  "booking_mode_snapshot" "BookingMode" NOT NULL,
  "booking_status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
  "payment_status" "PaymentStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
  "traveler_note" VARCHAR(1000),
  "business_note" VARCHAR(1000),
  "cancellation_reason" VARCHAR(1000),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "bookings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "bookings_time_range_check" CHECK ("start_at" < "end_at"),
  CONSTRAINT "bookings_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "bookings_guest_count_check" CHECK ("guest_count" IS NULL OR "guest_count" > 0),
  CONSTRAINT "bookings_money_check" CHECK ("subtotal" >= 0 AND ("unit_price" IS NULL OR "unit_price" >= 0) AND (("unit_price" IS NULL AND "currency" IS NULL) OR ("unit_price" IS NOT NULL AND "currency" ~ '^[A-Z]{3}$')))
);

CREATE TABLE "booking_status_history" (
  "id" UUID NOT NULL,
  "booking_id" UUID NOT NULL,
  "from_status" "BookingStatus",
  "to_status" "BookingStatus" NOT NULL,
  "changed_by_id" UUID,
  "note" VARCHAR(1000),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "booking_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "service_booking_configs_service_id_key" ON "service_booking_configs"("service_id");
CREATE INDEX "service_booking_configs_enabled_idx" ON "service_booking_configs"("enabled");
CREATE INDEX "service_booking_configs_booking_mode_idx" ON "service_booking_configs"("booking_mode");
CREATE INDEX "service_availability_rules_service_id_weekday_is_active_idx" ON "service_availability_rules"("service_id", "weekday", "is_active");
CREATE INDEX "service_availability_rules_valid_from_valid_until_idx" ON "service_availability_rules"("valid_from", "valid_until");
CREATE INDEX "service_availability_overrides_service_id_start_at_end_at_idx" ON "service_availability_overrides"("service_id", "start_at", "end_at");
CREATE INDEX "service_availability_overrides_type_idx" ON "service_availability_overrides"("type");
CREATE UNIQUE INDEX "bookings_reference_key" ON "bookings"("reference");
CREATE INDEX "bookings_traveler_id_created_at_idx" ON "bookings"("traveler_id", "created_at");
CREATE INDEX "bookings_business_id_created_at_idx" ON "bookings"("business_id", "created_at");
CREATE INDEX "bookings_service_id_start_at_end_at_idx" ON "bookings"("service_id", "start_at", "end_at");
CREATE INDEX "bookings_booking_status_created_at_idx" ON "bookings"("booking_status", "created_at");
CREATE INDEX "bookings_payment_status_idx" ON "bookings"("payment_status");
CREATE INDEX "booking_status_history_booking_id_created_at_idx" ON "booking_status_history"("booking_id", "created_at");
CREATE INDEX "booking_status_history_changed_by_id_idx" ON "booking_status_history"("changed_by_id");
CREATE INDEX "booking_status_history_to_status_created_at_idx" ON "booking_status_history"("to_status", "created_at");

-- AddForeignKey
ALTER TABLE "service_booking_configs" ADD CONSTRAINT "service_booking_configs_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_availability_rules" ADD CONSTRAINT "service_availability_rules_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_availability_overrides" ADD CONSTRAINT "service_availability_overrides_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_traveler_id_fkey" FOREIGN KEY ("traveler_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "booking_status_history" ADD CONSTRAINT "booking_status_history_changed_by_id_fkey" FOREIGN KEY ("changed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


