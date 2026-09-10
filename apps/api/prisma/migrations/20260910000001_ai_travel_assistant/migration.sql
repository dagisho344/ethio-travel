-- Phase 11: additive AI assistant history, usage, and validated trip-suggestion storage.
CREATE TYPE "AiMessageRole" AS ENUM ('USER', 'ASSISTANT');
CREATE TYPE "AiIntent" AS ENUM (
  'GENERAL_TRAVEL',
  'DESTINATION_DISCOVERY',
  'BUSINESS_RECOMMENDATION',
  'SERVICE_RECOMMENDATION',
  'ATTRACTION_RECOMMENDATION',
  'TRIP_ITINERARY',
  'TRIP_IMPROVEMENT'
);
CREATE TYPE "AiSuggestionStatus" AS ENUM ('PENDING', 'APPLYING', 'APPLIED', 'DISMISSED', 'INVALID');

CREATE TABLE "ai_conversations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "trip_id" UUID,
  "title" VARCHAR(160),
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ai_conversations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_conversations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ai_conversations_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ai_messages" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "conversation_id" UUID NOT NULL,
  "role" "AiMessageRole" NOT NULL,
  "content" VARCHAR(4000) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_messages_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_messages_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ai_messages_content_not_blank" CHECK (char_length(btrim("content")) > 0)
);

CREATE TABLE "ai_usage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "conversation_id" UUID,
  "provider" VARCHAR(80) NOT NULL,
  "model" VARCHAR(160) NOT NULL,
  "intent" "AiIntent" NOT NULL,
  "input_tokens" INTEGER,
  "output_tokens" INTEGER,
  "duration_ms" INTEGER,
  "success" BOOLEAN NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_usage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ai_usage_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ai_usage_duration_nonnegative" CHECK ("duration_ms" IS NULL OR "duration_ms" >= 0)
);

CREATE TABLE "ai_suggestions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "trip_id" UUID NOT NULL,
  "conversation_id" UUID,
  "trip_item_type" "TripItemType" NOT NULL,
  "target_entity_id" UUID NOT NULL,
  "title_snapshot" VARCHAR(180) NOT NULL,
  "reason" VARCHAR(1000) NOT NULL,
  "suggested_day_number" INTEGER NOT NULL,
  "suggested_date" DATE NOT NULL,
  "notes" VARCHAR(1000),
  "status" "AiSuggestionStatus" NOT NULL DEFAULT 'PENDING',
  "applied_trip_item_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "applied_at" TIMESTAMP(3),
  CONSTRAINT "ai_suggestions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ai_suggestions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ai_suggestions_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ai_suggestions_conversation_id_fkey" FOREIGN KEY ("conversation_id") REFERENCES "ai_conversations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ai_suggestions_applied_trip_item_id_fkey" FOREIGN KEY ("applied_trip_item_id") REFERENCES "trip_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ai_suggestions_day_positive" CHECK ("suggested_day_number" > 0),
  CONSTRAINT "ai_suggestions_reason_not_blank" CHECK (char_length(btrim("reason")) > 0)
);

CREATE INDEX "ai_conversations_user_id_updated_at_idx" ON "ai_conversations"("user_id", "updated_at");
CREATE INDEX "ai_conversations_user_id_trip_id_idx" ON "ai_conversations"("user_id", "trip_id");
CREATE INDEX "ai_conversations_trip_id_idx" ON "ai_conversations"("trip_id");
CREATE INDEX "ai_messages_conversation_id_created_at_idx" ON "ai_messages"("conversation_id", "created_at");
CREATE INDEX "ai_usage_user_id_created_at_idx" ON "ai_usage"("user_id", "created_at");
CREATE INDEX "ai_usage_conversation_id_created_at_idx" ON "ai_usage"("conversation_id", "created_at");
CREATE INDEX "ai_usage_intent_created_at_idx" ON "ai_usage"("intent", "created_at");
CREATE INDEX "ai_suggestions_user_id_trip_id_status_created_at_idx" ON "ai_suggestions"("user_id", "trip_id", "status", "created_at");
CREATE INDEX "ai_suggestions_trip_id_suggested_date_idx" ON "ai_suggestions"("trip_id", "suggested_date");
CREATE INDEX "ai_suggestions_conversation_id_idx" ON "ai_suggestions"("conversation_id");
CREATE INDEX "ai_suggestions_applied_trip_item_id_idx" ON "ai_suggestions"("applied_trip_item_id");