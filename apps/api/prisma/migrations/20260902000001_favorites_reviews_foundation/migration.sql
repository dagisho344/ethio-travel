-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('PENDING', 'PUBLISHED', 'HIDDEN', 'REJECTED');

-- CreateTable
CREATE TABLE "favorites" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "business_id" UUID,
  "service_id" UUID,
  "destination_id" UUID,
  "attraction_id" UUID,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "favorites_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "favorites_exactly_one_target_check" CHECK ((("business_id" IS NOT NULL)::int + ("service_id" IS NOT NULL)::int + ("destination_id" IS NOT NULL)::int + ("attraction_id" IS NOT NULL)::int) = 1)
);

CREATE TABLE "reviews" (
  "id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "moderated_by_id" UUID,
  "business_id" UUID,
  "service_id" UUID,
  "destination_id" UUID,
  "attraction_id" UUID,
  "rating" INTEGER NOT NULL,
  "title" VARCHAR(120),
  "body" TEXT,
  "status" "ReviewStatus" NOT NULL DEFAULT 'PENDING',
  "moderation_note" TEXT,
  "moderated_at" TIMESTAMP(3),
  "published_at" TIMESTAMP(3),
  "hidden_at" TIMESTAMP(3),
  "rejected_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "reviews_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "reviews_rating_check" CHECK ("rating" >= 1 AND "rating" <= 5),
  CONSTRAINT "reviews_exactly_one_target_check" CHECK ((("business_id" IS NOT NULL)::int + ("service_id" IS NOT NULL)::int + ("destination_id" IS NOT NULL)::int + ("attraction_id" IS NOT NULL)::int) = 1)
);

-- CreateIndex
CREATE INDEX "favorites_user_id_created_at_idx" ON "favorites"("user_id", "created_at");
CREATE INDEX "favorites_business_id_idx" ON "favorites"("business_id");
CREATE INDEX "favorites_service_id_idx" ON "favorites"("service_id");
CREATE INDEX "favorites_destination_id_idx" ON "favorites"("destination_id");
CREATE INDEX "favorites_attraction_id_idx" ON "favorites"("attraction_id");
CREATE UNIQUE INDEX "favorites_user_business_unique" ON "favorites"("user_id", "business_id") WHERE "business_id" IS NOT NULL;
CREATE UNIQUE INDEX "favorites_user_service_unique" ON "favorites"("user_id", "service_id") WHERE "service_id" IS NOT NULL;
CREATE UNIQUE INDEX "favorites_user_destination_unique" ON "favorites"("user_id", "destination_id") WHERE "destination_id" IS NOT NULL;
CREATE UNIQUE INDEX "favorites_user_attraction_unique" ON "favorites"("user_id", "attraction_id") WHERE "attraction_id" IS NOT NULL;

CREATE INDEX "reviews_status_created_at_idx" ON "reviews"("status", "created_at");
CREATE INDEX "reviews_user_id_created_at_idx" ON "reviews"("user_id", "created_at");
CREATE INDEX "reviews_moderated_by_id_idx" ON "reviews"("moderated_by_id");
CREATE INDEX "reviews_published_at_idx" ON "reviews"("published_at");
CREATE INDEX "reviews_business_id_status_idx" ON "reviews"("business_id", "status");
CREATE INDEX "reviews_service_id_status_idx" ON "reviews"("service_id", "status");
CREATE INDEX "reviews_destination_id_status_idx" ON "reviews"("destination_id", "status");
CREATE INDEX "reviews_attraction_id_status_idx" ON "reviews"("attraction_id", "status");
CREATE UNIQUE INDEX "reviews_user_business_unique" ON "reviews"("user_id", "business_id") WHERE "business_id" IS NOT NULL;
CREATE UNIQUE INDEX "reviews_user_service_unique" ON "reviews"("user_id", "service_id") WHERE "service_id" IS NOT NULL;
CREATE UNIQUE INDEX "reviews_user_destination_unique" ON "reviews"("user_id", "destination_id") WHERE "destination_id" IS NOT NULL;
CREATE UNIQUE INDEX "reviews_user_attraction_unique" ON "reviews"("user_id", "attraction_id") WHERE "attraction_id" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_attraction_id_fkey" FOREIGN KEY ("attraction_id") REFERENCES "attractions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "reviews" ADD CONSTRAINT "reviews_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_moderated_by_id_fkey" FOREIGN KEY ("moderated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_attraction_id_fkey" FOREIGN KEY ("attraction_id") REFERENCES "attractions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;