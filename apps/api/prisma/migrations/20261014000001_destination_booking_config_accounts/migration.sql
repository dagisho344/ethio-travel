-- Destination booking remains disabled until fulfillment and cancellation policy is approved.
-- This migration stores Admin-only configuration and destination-specific manual accounts.
CREATE TYPE "DestinationPriceUnit" AS ENUM ('PER_BOOKING');
CREATE TYPE "DestinationPaymentProvider" AS ENUM ('TELEBIRR', 'CBE');

CREATE TABLE "destination_booking_configs" (
    "id" UUID NOT NULL,
    "destination_id" UUID NOT NULL,
    "booking_enabled" BOOLEAN NOT NULL DEFAULT false,
    "price_amount" DECIMAL(12,2),
    "currency" CHAR(3) NOT NULL DEFAULT 'ETB',
    "price_unit" "DestinationPriceUnit" NOT NULL DEFAULT 'PER_BOOKING',
    "booking_instructions" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "destination_booking_configs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "destination_booking_configs_positive_price_check" CHECK ("price_amount" IS NULL OR "price_amount" > 0),
    CONSTRAINT "destination_booking_configs_etb_check" CHECK ("currency" = 'ETB'),
    CONSTRAINT "destination_booking_configs_enabled_price_check" CHECK (NOT "booking_enabled" OR "price_amount" IS NOT NULL)
);

CREATE TABLE "destination_payment_accounts" (
    "id" UUID NOT NULL,
    "destination_id" UUID NOT NULL,
    "provider" "DestinationPaymentProvider" NOT NULL,
    "account_holder_name" VARCHAR(160) NOT NULL,
    "account_identifier" VARCHAR(64) NOT NULL,
    "normalized_identifier" VARCHAR(64) NOT NULL,
    "instructions" VARCHAR(1000),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "destination_payment_accounts_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "destination_payment_accounts_order_check" CHECK ("display_order" >= 0),
    CONSTRAINT "destination_payment_accounts_identifier_check" CHECK ("normalized_identifier" ~ '^\+?[A-Z0-9]{5,40}$'),
    CONSTRAINT "destination_payment_accounts_holder_check" CHECK (length(btrim("account_holder_name")) > 0)
);

CREATE UNIQUE INDEX "destination_booking_configs_destination_id_key" ON "destination_booking_configs"("destination_id");
CREATE UNIQUE INDEX "destination_payment_accounts_destination_id_provider_normalized_identifier_key" ON "destination_payment_accounts"("destination_id", "provider", "normalized_identifier");
CREATE INDEX "destination_payment_accounts_destination_id_is_active_display_order_id_idx" ON "destination_payment_accounts"("destination_id", "is_active", "display_order", "id");

ALTER TABLE "destination_booking_configs" ADD CONSTRAINT "destination_booking_configs_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "destination_payment_accounts" ADD CONSTRAINT "destination_payment_accounts_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
