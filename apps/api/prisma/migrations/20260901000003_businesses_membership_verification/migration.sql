-- CreateEnum
CREATE TYPE "BusinessStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'ARCHIVED');
CREATE TYPE "BusinessVerificationSummary" AS ENUM ('NOT_SUBMITTED', 'PENDING', 'VERIFIED', 'REJECTED');
CREATE TYPE "BusinessMemberRole" AS ENUM ('OWNER', 'MANAGER', 'STAFF');
CREATE TYPE "BusinessMemberStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'REMOVED');
CREATE TYPE "VerificationRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
CREATE TYPE "VerificationDocumentType" AS ENUM ('BUSINESS_LICENSE', 'TAX_DOCUMENT', 'OWNER_ID', 'ADDRESS_PROOF', 'OTHER');

-- CreateTable
CREATE TABLE "business_categories" (
    "id" UUID NOT NULL,
    "code" VARCHAR(80) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "businesses" (
    "id" UUID NOT NULL,
    "city_id" UUID NOT NULL,
    "destination_id" UUID,
    "category_id" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "description" TEXT NOT NULL,
    "phone" VARCHAR(40),
    "email" VARCHAR(254),
    "website" VARCHAR(2048),
    "address_line_1" VARCHAR(240) NOT NULL,
    "address_line_2" VARCHAR(240),
    "neighborhood" VARCHAR(120),
    "postal_code" VARCHAR(40),
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "status" "BusinessStatus" NOT NULL DEFAULT 'DRAFT',
    "verification_summary" "BusinessVerificationSummary" NOT NULL DEFAULT 'NOT_SUBMITTED',
    "published_at" TIMESTAMP(3),
    "suspended_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "businesses_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "businesses_latitude_check" CHECK ("latitude" >= -90 AND "latitude" <= 90),
    CONSTRAINT "businesses_longitude_check" CHECK ("longitude" >= -180 AND "longitude" <= 180)
);

CREATE TABLE "business_members" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "role" "BusinessMemberRole" NOT NULL,
    "status" "BusinessMemberStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_members_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "business_verifications" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "submitted_by_user_id" UUID NOT NULL,
    "status" "VerificationRequestStatus" NOT NULL DEFAULT 'PENDING',
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_user_id" UUID,
    "rejection_reason" TEXT,
    "admin_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_verifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "verification_documents" (
    "id" UUID NOT NULL,
    "verification_id" UUID NOT NULL,
    "type" "VerificationDocumentType" NOT NULL,
    "storage_reference" VARCHAR(500) NOT NULL,
    "original_filename" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(120) NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_documents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "verification_documents_size_bytes_check" CHECK ("size_bytes" > 0)
);

-- CreateIndex
CREATE UNIQUE INDEX "business_categories_code_key" ON "business_categories"("code");
CREATE INDEX "business_categories_is_active_idx" ON "business_categories"("is_active");
CREATE INDEX "business_categories_sort_order_idx" ON "business_categories"("sort_order");

CREATE UNIQUE INDEX "businesses_city_id_slug_key" ON "businesses"("city_id", "slug");
CREATE INDEX "businesses_city_id_idx" ON "businesses"("city_id");
CREATE INDEX "businesses_destination_id_idx" ON "businesses"("destination_id");
CREATE INDEX "businesses_category_id_idx" ON "businesses"("category_id");
CREATE INDEX "businesses_status_idx" ON "businesses"("status");
CREATE INDEX "businesses_verification_summary_idx" ON "businesses"("verification_summary");
CREATE INDEX "businesses_name_idx" ON "businesses"("name");
CREATE INDEX "businesses_latitude_longitude_idx" ON "businesses"("latitude", "longitude");
CREATE INDEX "businesses_status_verification_summary_category_id_idx" ON "businesses"("status", "verification_summary", "category_id");

CREATE UNIQUE INDEX "business_members_business_id_user_id_key" ON "business_members"("business_id", "user_id");
CREATE INDEX "business_members_business_id_idx" ON "business_members"("business_id");
CREATE INDEX "business_members_user_id_idx" ON "business_members"("user_id");
CREATE INDEX "business_members_role_idx" ON "business_members"("role");
CREATE INDEX "business_members_status_idx" ON "business_members"("status");
CREATE INDEX "business_members_business_id_role_status_idx" ON "business_members"("business_id", "role", "status");

CREATE INDEX "business_verifications_business_id_idx" ON "business_verifications"("business_id");
CREATE INDEX "business_verifications_submitted_by_user_id_idx" ON "business_verifications"("submitted_by_user_id");
CREATE INDEX "business_verifications_reviewed_by_user_id_idx" ON "business_verifications"("reviewed_by_user_id");
CREATE INDEX "business_verifications_status_idx" ON "business_verifications"("status");
CREATE INDEX "business_verifications_submitted_at_idx" ON "business_verifications"("submitted_at");
CREATE UNIQUE INDEX "business_verifications_one_pending_per_business" ON "business_verifications"("business_id") WHERE "status" = 'PENDING';

CREATE INDEX "verification_documents_verification_id_idx" ON "verification_documents"("verification_id");
CREATE INDEX "verification_documents_type_idx" ON "verification_documents"("type");

-- AddForeignKey
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "businesses" ADD CONSTRAINT "businesses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "business_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_members" ADD CONSTRAINT "business_members_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_members" ADD CONSTRAINT "business_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_verifications" ADD CONSTRAINT "business_verifications_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_verifications" ADD CONSTRAINT "business_verifications_submitted_by_user_id_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_verifications" ADD CONSTRAINT "business_verifications_reviewed_by_user_id_fkey" FOREIGN KEY ("reviewed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_verification_id_fkey" FOREIGN KEY ("verification_id") REFERENCES "business_verifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
