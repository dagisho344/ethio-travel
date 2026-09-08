-- CreateEnum
CREATE TYPE "PaymentProvider" AS ENUM ('DEVELOPMENT', 'STRIPE');
CREATE TYPE "PaymentTransactionType" AS ENUM ('PAYMENT_INITIATED', 'PROVIDER_AUTHORIZATION', 'PAYMENT_CAPTURED', 'PAYMENT_FAILED', 'REFUND_INITIATED', 'REFUND_SUCCEEDED', 'REFUND_FAILED');
CREATE TYPE "PaymentTransactionStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');
CREATE TYPE "PaymentWebhookProcessingStatus" AS ENUM ('RECEIVED', 'PROCESSED', 'FAILED', 'IGNORED');
CREATE TYPE "PaymentRefundStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "payments" (
  "id" UUID NOT NULL,
  "booking_id" UUID NOT NULL,
  "traveler_id" UUID NOT NULL,
  "business_id" UUID NOT NULL,
  "provider" "PaymentProvider" NOT NULL,
  "provider_payment_id" VARCHAR(191),
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "method" VARCHAR(80),
  "idempotency_key" VARCHAR(160),
  "paid_at" TIMESTAMP(3),
  "failed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payments_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "payments_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "payments_status_timestamp_check" CHECK (("status" = 'PAID' AND "paid_at" IS NOT NULL AND "failed_at" IS NULL) OR ("status" = 'FAILED' AND "failed_at" IS NOT NULL AND "paid_at" IS NULL) OR ("status" NOT IN ('PAID', 'FAILED')))
);

CREATE TABLE "payment_transactions" (
  "id" UUID NOT NULL,
  "payment_id" UUID NOT NULL,
  "type" "PaymentTransactionType" NOT NULL,
  "provider_transaction_id" VARCHAR(191),
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "status" "PaymentTransactionStatus" NOT NULL DEFAULT 'PENDING',
  "provider_metadata" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_transactions_amount_check" CHECK ("amount" >= 0),
  CONSTRAINT "payment_transactions_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$')
);

CREATE TABLE "payment_webhook_events" (
  "id" UUID NOT NULL,
  "provider" "PaymentProvider" NOT NULL,
  "provider_event_id" VARCHAR(191) NOT NULL,
  "event_type" VARCHAR(160) NOT NULL,
  "payload" JSONB NOT NULL,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMP(3),
  "processing_status" "PaymentWebhookProcessingStatus" NOT NULL DEFAULT 'RECEIVED',
  "failure_reason" VARCHAR(1000),
  CONSTRAINT "payment_webhook_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "payment_refunds" (
  "id" UUID NOT NULL,
  "payment_id" UUID NOT NULL,
  "provider_refund_id" VARCHAR(191),
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "reason" VARCHAR(500),
  "status" "PaymentRefundStatus" NOT NULL DEFAULT 'PENDING',
  "idempotency_key" VARCHAR(160),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMP(3),
  CONSTRAINT "payment_refunds_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payment_refunds_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "payment_refunds_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$')
);

-- CreateIndex
CREATE UNIQUE INDEX "payments_booking_id_idempotency_key_key" ON "payments"("booking_id", "idempotency_key");
CREATE UNIQUE INDEX "payments_one_active_per_booking" ON "payments"("booking_id") WHERE "status" IN ('PENDING', 'PAID', 'PARTIALLY_REFUNDED');
CREATE UNIQUE INDEX "payments_provider_payment_id_key" ON "payments"("provider", "provider_payment_id") WHERE "provider_payment_id" IS NOT NULL;
CREATE INDEX "payments_booking_id_created_at_idx" ON "payments"("booking_id", "created_at");
CREATE INDEX "payments_traveler_id_created_at_idx" ON "payments"("traveler_id", "created_at");
CREATE INDEX "payments_business_id_created_at_idx" ON "payments"("business_id", "created_at");
CREATE INDEX "payments_status_created_at_idx" ON "payments"("status", "created_at");
CREATE INDEX "payments_provider_created_at_idx" ON "payments"("provider", "created_at");
CREATE INDEX "payments_provider_payment_id_idx" ON "payments"("provider_payment_id");

CREATE INDEX "payment_transactions_payment_id_created_at_idx" ON "payment_transactions"("payment_id", "created_at");
CREATE INDEX "payment_transactions_type_created_at_idx" ON "payment_transactions"("type", "created_at");
CREATE INDEX "payment_transactions_status_created_at_idx" ON "payment_transactions"("status", "created_at");
CREATE INDEX "payment_transactions_provider_transaction_id_idx" ON "payment_transactions"("provider_transaction_id");
CREATE UNIQUE INDEX "payment_transactions_provider_transaction_id_key" ON "payment_transactions"("provider_transaction_id") WHERE "provider_transaction_id" IS NOT NULL;

CREATE UNIQUE INDEX "payment_webhook_events_provider_provider_event_id_key" ON "payment_webhook_events"("provider", "provider_event_id");
CREATE INDEX "payment_webhook_events_provider_received_at_idx" ON "payment_webhook_events"("provider", "received_at");
CREATE INDEX "payment_webhook_events_processing_status_received_at_idx" ON "payment_webhook_events"("processing_status", "received_at");

CREATE UNIQUE INDEX "payment_refunds_payment_id_idempotency_key_key" ON "payment_refunds"("payment_id", "idempotency_key");
CREATE UNIQUE INDEX "payment_refunds_provider_refund_id_key" ON "payment_refunds"("provider_refund_id") WHERE "provider_refund_id" IS NOT NULL;
CREATE INDEX "payment_refunds_payment_id_created_at_idx" ON "payment_refunds"("payment_id", "created_at");
CREATE INDEX "payment_refunds_status_created_at_idx" ON "payment_refunds"("status", "created_at");
CREATE INDEX "payment_refunds_provider_refund_id_idx" ON "payment_refunds"("provider_refund_id");

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_traveler_id_fkey" FOREIGN KEY ("traveler_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payments" ADD CONSTRAINT "payments_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "payment_refunds" ADD CONSTRAINT "payment_refunds_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;