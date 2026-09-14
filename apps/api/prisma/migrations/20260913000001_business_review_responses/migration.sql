-- Phase 12D: additive official business responses to reviews.
-- Existing reviews and moderation history remain unchanged.
CREATE TABLE "review_responses" (
  "id" UUID NOT NULL,
  "review_id" UUID NOT NULL,
  "business_id" UUID NOT NULL,
  "author_user_id" UUID NOT NULL,
  "body" VARCHAR(2000) NOT NULL,
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "review_responses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "review_responses_review_id_business_id_key" UNIQUE ("review_id", "business_id"),
  CONSTRAINT "review_responses_review_id_fkey" FOREIGN KEY ("review_id") REFERENCES "reviews"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "review_responses_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "review_responses_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "review_responses_business_id_archived_at_created_at_idx" ON "review_responses"("business_id", "archived_at", "created_at");
CREATE INDEX "review_responses_author_user_id_idx" ON "review_responses"("author_user_id");