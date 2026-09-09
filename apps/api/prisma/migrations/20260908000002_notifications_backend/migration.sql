-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM (
  'BOOKING_CREATED', 'BOOKING_CONFIRMED', 'BOOKING_REJECTED',
  'BOOKING_CANCELLED', 'BOOKING_COMPLETED', 'BOOKING_NO_SHOW',
  'PAYMENT_SUCCEEDED', 'PAYMENT_FAILED', 'PAYMENT_REFUNDED',
  'MESSAGE_RECEIVED', 'BUSINESS_VERIFICATION_APPROVED',
  'BUSINESS_VERIFICATION_REJECTED', 'REVIEW_PUBLISHED',
  'REVIEW_REJECTED', 'REVIEW_HIDDEN'
);

-- CreateTable
CREATE TABLE "notifications" (
  "id" UUID NOT NULL,
  "recipient_user_id" UUID NOT NULL,
  "actor_user_id" UUID,
  "type" "NotificationType" NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "body" VARCHAR(500) NOT NULL,
  "action_url" VARCHAR(2048),
  "metadata" JSONB,
  "dedupe_key" VARCHAR(255),
  "read_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "notifications_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "notifications_title_not_blank_check" CHECK (length(btrim("title")) > 0),
  CONSTRAINT "notifications_body_not_blank_check" CHECK (length(btrim("body")) > 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "notifications_dedupe_key_key" ON "notifications"("dedupe_key");
CREATE INDEX "notifications_recipient_user_id_created_at_idx" ON "notifications"("recipient_user_id", "created_at");
CREATE INDEX "notifications_recipient_user_id_read_at_idx" ON "notifications"("recipient_user_id", "read_at");
CREATE INDEX "notifications_type_created_at_idx" ON "notifications"("type", "created_at");

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_user_id_fkey" FOREIGN KEY ("recipient_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;