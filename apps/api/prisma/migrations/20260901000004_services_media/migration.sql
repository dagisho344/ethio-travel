-- CreateEnum
CREATE TYPE "ServiceStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'INACTIVE', 'ARCHIVED');
CREATE TYPE "PricingModel" AS ENUM ('FIXED', 'PER_PERSON', 'PER_NIGHT', 'PER_HOUR', 'PER_DAY', 'STARTING_FROM', 'FREE', 'CONTACT_FOR_PRICE');
CREATE TYPE "ServiceLocationMode" AS ENUM ('BUSINESS_LOCATION', 'CUSTOM_LOCATION', 'MOBILE_VARIABLE');
CREATE TYPE "MediaType" AS ENUM ('IMAGE', 'VIDEO');
CREATE TYPE "MediaVisibility" AS ENUM ('PUBLIC', 'PRIVATE');
CREATE TYPE "MediaStatus" AS ENUM ('PENDING_UPLOAD', 'READY', 'FAILED', 'ARCHIVED');
CREATE TYPE "MediaRole" AS ENUM ('GALLERY', 'HERO', 'LOGO');

-- CreateTable
CREATE TABLE "service_categories" (
  "id" UUID NOT NULL,
  "code" VARCHAR(80) NOT NULL,
  "name" VARCHAR(120) NOT NULL,
  "description" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "service_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "services" (
  "id" UUID NOT NULL,
  "business_id" UUID NOT NULL,
  "category_id" UUID NOT NULL,
  "name" VARCHAR(180) NOT NULL,
  "slug" VARCHAR(200) NOT NULL,
  "short_description" VARCHAR(300) NOT NULL,
  "description" TEXT NOT NULL,
  "price" DECIMAL(12,2),
  "currency" CHAR(3),
  "pricing_model" "PricingModel" NOT NULL,
  "duration_minutes" INTEGER,
  "min_guests" INTEGER,
  "max_guests" INTEGER,
  "location_mode" "ServiceLocationMode" NOT NULL DEFAULT 'BUSINESS_LOCATION',
  "address" VARCHAR(240),
  "latitude" DECIMAL(9,6),
  "longitude" DECIMAL(9,6),
  "attributes" JSONB,
  "status" "ServiceStatus" NOT NULL DEFAULT 'DRAFT',
  "published_at" TIMESTAMP(3),
  "archived_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "services_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "services_price_non_negative_check" CHECK ("price" IS NULL OR "price" >= 0),
  CONSTRAINT "services_pricing_check" CHECK ((("pricing_model" = 'FREE' AND ("price" IS NULL OR "price" = 0) AND "currency" IS NULL) OR ("pricing_model" = 'CONTACT_FOR_PRICE' AND "price" IS NULL AND "currency" IS NULL) OR ("pricing_model" IN ('FIXED', 'PER_PERSON', 'PER_NIGHT', 'PER_HOUR', 'PER_DAY', 'STARTING_FROM') AND "price" IS NOT NULL AND "price" >= 0 AND "currency" IS NOT NULL AND "currency" ~ '^[A-Z]{3}$'))),
  CONSTRAINT "services_currency_format_check" CHECK ("currency" IS NULL OR "currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "services_duration_minutes_check" CHECK ("duration_minutes" IS NULL OR "duration_minutes" > 0),
  CONSTRAINT "services_min_guests_check" CHECK ("min_guests" IS NULL OR "min_guests" > 0),
  CONSTRAINT "services_max_guests_check" CHECK ("max_guests" IS NULL OR "max_guests" > 0),
  CONSTRAINT "services_guest_range_check" CHECK ("min_guests" IS NULL OR "max_guests" IS NULL OR "min_guests" <= "max_guests"),
  CONSTRAINT "services_location_mode_check" CHECK ((("location_mode" = 'BUSINESS_LOCATION' AND "address" IS NULL AND "latitude" IS NULL AND "longitude" IS NULL) OR ("location_mode" = 'CUSTOM_LOCATION' AND "address" IS NOT NULL AND "latitude" IS NOT NULL AND "longitude" IS NOT NULL) OR ("location_mode" = 'MOBILE_VARIABLE' AND (("latitude" IS NULL AND "longitude" IS NULL) OR ("latitude" IS NOT NULL AND "longitude" IS NOT NULL))))),
  CONSTRAINT "services_latitude_check" CHECK ("latitude" IS NULL OR ("latitude" >= -90 AND "latitude" <= 90)),
  CONSTRAINT "services_longitude_check" CHECK ("longitude" IS NULL OR ("longitude" >= -180 AND "longitude" <= 180))
);

CREATE TABLE "media_assets" (
  "id" UUID NOT NULL,
  "storage_key" VARCHAR(500) NOT NULL,
  "original_filename" VARCHAR(255) NOT NULL,
  "mime_type" VARCHAR(120) NOT NULL,
  "media_type" "MediaType" NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "duration_seconds" INTEGER,
  "checksum" VARCHAR(128),
  "visibility" "MediaVisibility" NOT NULL DEFAULT 'PUBLIC',
  "status" "MediaStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "media_assets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "media_assets_size_bytes_check" CHECK ("size_bytes" > 0),
  CONSTRAINT "media_assets_width_check" CHECK ("width" IS NULL OR "width" > 0),
  CONSTRAINT "media_assets_height_check" CHECK ("height" IS NULL OR "height" > 0),
  CONSTRAINT "media_assets_duration_seconds_check" CHECK ("duration_seconds" IS NULL OR "duration_seconds" > 0)
);

CREATE TABLE "business_media" (
  "id" UUID NOT NULL,
  "business_id" UUID NOT NULL,
  "media_id" UUID NOT NULL,
  "role" "MediaRole" NOT NULL DEFAULT 'GALLERY',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "alt_text" VARCHAR(240),
  "caption" VARCHAR(500),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "business_media_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "service_media" (
  "id" UUID NOT NULL,
  "service_id" UUID NOT NULL,
  "media_id" UUID NOT NULL,
  "role" "MediaRole" NOT NULL DEFAULT 'GALLERY',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "alt_text" VARCHAR(240),
  "caption" VARCHAR(500),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "service_media_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "service_media_role_check" CHECK ("role" IN ('GALLERY', 'HERO'))
);

CREATE TABLE "destination_media" (
  "id" UUID NOT NULL,
  "destination_id" UUID NOT NULL,
  "media_id" UUID NOT NULL,
  "role" "MediaRole" NOT NULL DEFAULT 'GALLERY',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "alt_text" VARCHAR(240),
  "caption" VARCHAR(500),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "destination_media_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "destination_media_role_check" CHECK ("role" IN ('GALLERY', 'HERO'))
);

CREATE TABLE "attraction_media" (
  "id" UUID NOT NULL,
  "attraction_id" UUID NOT NULL,
  "media_id" UUID NOT NULL,
  "role" "MediaRole" NOT NULL DEFAULT 'GALLERY',
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "alt_text" VARCHAR(240),
  "caption" VARCHAR(500),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "attraction_media_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attraction_media_role_check" CHECK ("role" IN ('GALLERY', 'HERO'))
);

-- CreateIndex
CREATE UNIQUE INDEX "service_categories_code_key" ON "service_categories"("code");
CREATE INDEX "service_categories_is_active_idx" ON "service_categories"("is_active");
CREATE INDEX "service_categories_sort_order_idx" ON "service_categories"("sort_order");
CREATE UNIQUE INDEX "services_business_id_slug_key" ON "services"("business_id", "slug");
CREATE INDEX "services_business_id_idx" ON "services"("business_id");
CREATE INDEX "services_category_id_idx" ON "services"("category_id");
CREATE INDEX "services_status_idx" ON "services"("status");
CREATE INDEX "services_pricing_model_idx" ON "services"("pricing_model");
CREATE INDEX "services_name_idx" ON "services"("name");
CREATE INDEX "services_price_idx" ON "services"("price");
CREATE INDEX "services_latitude_longitude_idx" ON "services"("latitude", "longitude");
CREATE INDEX "services_status_category_id_pricing_model_idx" ON "services"("status", "category_id", "pricing_model");
CREATE UNIQUE INDEX "media_assets_storage_key_key" ON "media_assets"("storage_key");
CREATE INDEX "media_assets_created_by_user_id_idx" ON "media_assets"("created_by_user_id");
CREATE INDEX "media_assets_media_type_idx" ON "media_assets"("media_type");
CREATE INDEX "media_assets_visibility_idx" ON "media_assets"("visibility");
CREATE INDEX "media_assets_status_idx" ON "media_assets"("status");
CREATE UNIQUE INDEX "business_media_business_id_media_id_key" ON "business_media"("business_id", "media_id");
CREATE INDEX "business_media_business_id_idx" ON "business_media"("business_id");
CREATE INDEX "business_media_media_id_idx" ON "business_media"("media_id");
CREATE INDEX "business_media_role_idx" ON "business_media"("role");
CREATE INDEX "business_media_sort_order_idx" ON "business_media"("sort_order");
CREATE UNIQUE INDEX "service_media_service_id_media_id_key" ON "service_media"("service_id", "media_id");
CREATE INDEX "service_media_service_id_idx" ON "service_media"("service_id");
CREATE INDEX "service_media_media_id_idx" ON "service_media"("media_id");
CREATE INDEX "service_media_role_idx" ON "service_media"("role");
CREATE INDEX "service_media_sort_order_idx" ON "service_media"("sort_order");
CREATE UNIQUE INDEX "destination_media_destination_id_media_id_key" ON "destination_media"("destination_id", "media_id");
CREATE INDEX "destination_media_destination_id_idx" ON "destination_media"("destination_id");
CREATE INDEX "destination_media_media_id_idx" ON "destination_media"("media_id");
CREATE INDEX "destination_media_role_idx" ON "destination_media"("role");
CREATE INDEX "destination_media_sort_order_idx" ON "destination_media"("sort_order");
CREATE UNIQUE INDEX "attraction_media_attraction_id_media_id_key" ON "attraction_media"("attraction_id", "media_id");
CREATE INDEX "attraction_media_attraction_id_idx" ON "attraction_media"("attraction_id");
CREATE INDEX "attraction_media_media_id_idx" ON "attraction_media"("media_id");
CREATE INDEX "attraction_media_role_idx" ON "attraction_media"("role");
CREATE INDEX "attraction_media_sort_order_idx" ON "attraction_media"("sort_order");
CREATE UNIQUE INDEX "business_media_one_hero" ON "business_media"("business_id") WHERE "role" = 'HERO';
CREATE UNIQUE INDEX "business_media_one_logo" ON "business_media"("business_id") WHERE "role" = 'LOGO';
CREATE UNIQUE INDEX "service_media_one_hero" ON "service_media"("service_id") WHERE "role" = 'HERO';
CREATE UNIQUE INDEX "destination_media_one_hero" ON "destination_media"("destination_id") WHERE "role" = 'HERO';
CREATE UNIQUE INDEX "attraction_media_one_hero" ON "attraction_media"("attraction_id") WHERE "role" = 'HERO';

-- AddForeignKey
ALTER TABLE "services" ADD CONSTRAINT "services_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "services" ADD CONSTRAINT "services_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "service_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_media" ADD CONSTRAINT "business_media_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "business_media" ADD CONSTRAINT "business_media_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_media" ADD CONSTRAINT "service_media_service_id_fkey" FOREIGN KEY ("service_id") REFERENCES "services"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "service_media" ADD CONSTRAINT "service_media_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "destination_media" ADD CONSTRAINT "destination_media_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "destination_media" ADD CONSTRAINT "destination_media_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attraction_media" ADD CONSTRAINT "attraction_media_attraction_id_fkey" FOREIGN KEY ("attraction_id") REFERENCES "attractions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attraction_media" ADD CONSTRAINT "attraction_media_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
