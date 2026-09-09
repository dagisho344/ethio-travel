-- CreateEnum
CREATE TYPE "ConversationStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "ConversationMemberRole" AS ENUM ('TRAVELER', 'BUSINESS_MEMBER');
CREATE TYPE "ConversationMemberStatus" AS ENUM ('ACTIVE', 'ARCHIVED');
CREATE TYPE "MessageStatus" AS ENUM ('SENT', 'DELETED');

-- CreateTable
CREATE TABLE "conversations" (
  "id" UUID NOT NULL,
  "business_id" UUID NOT NULL,
  "booking_id" UUID,
  "subject" VARCHAR(160),
  "status" "ConversationStatus" NOT NULL DEFAULT 'ACTIVE',
  "last_message_at" TIMESTAMP(3),
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "conversations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "conversations_status_timestamp_check" CHECK (("status" = 'ARCHIVED' AND "archived_at" IS NOT NULL) OR ("status" = 'ACTIVE' AND "archived_at" IS NULL))
);

CREATE TABLE "conversation_members" (
  "id" UUID NOT NULL,
  "conversation_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "role" "ConversationMemberRole" NOT NULL,
  "status" "ConversationMemberStatus" NOT NULL DEFAULT 'ACTIVE',
  "last_read_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "conversation_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "messages" (
  "id" UUID NOT NULL,
  "conversation_id" UUID NOT NULL,
  "sender_id" UUID NOT NULL,
  "body" VARCHAR(5000) NOT NULL,
  "status" "MessageStatus" NOT NULL DEFAULT 'SENT',
  "edited_at" TIMESTAMP(3),
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "messages_body_not_blank_check" CHECK (length(btrim("body")) > 0),
  CONSTRAINT "messages_status_timestamp_check" CHECK (("status" = 'DELETED' AND "deleted_at" IS NOT NULL) OR ("status" = 'SENT' AND "deleted_at" IS NULL))
);

-- CreateIndex
CREATE UNIQUE INDEX "conversations_booking_id_key" ON "conversations"("booking_id");
CREATE INDEX "conversations_business_id_updated_at_idx" ON "conversations"("business_id", "updated_at");
CREATE INDEX "conversations_booking_id_idx" ON "conversations"("booking_id");
CREATE INDEX "conversations_status_updated_at_idx" ON "conversations"("status", "updated_at");
CREATE INDEX "conversations_last_message_at_idx" ON "conversations"("last_message_at");

CREATE UNIQUE INDEX "conversation_members_conversation_id_user_id_key" ON "conversation_members"("conversation_id", "user_id");
CREATE INDEX "conversation_members_user_id_status_updated_at_idx" ON "conversation_members"("user_id", "status", "updated_at");
CREATE INDEX "conversation_members_conversation_id_status_idx" ON "conversation_members"("conversation_id", "status");
CREATE INDEX "conversation_members_role_idx" ON "conversation_members"("role");

CREATE INDEX "messages_conversation_id_created_at_idx" ON "messages"("conversation_id", "created_at");
CREATE INDEX "messages_sender_id_created_at_idx" ON "messages"("sender_id", "created_at");
CREATE INDEX "messages_status_created_at_idx" ON "messages"("status", "created_at");

-- AddForeignKey
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversations" ADD CONSTRAINT "conversations_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conversation_members" ADD CONSTRAINT "conversation_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
