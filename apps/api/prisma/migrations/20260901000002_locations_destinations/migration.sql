-- CreateEnum
CREATE TYPE "LocationStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'INACTIVE', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "AttractionCategory" AS ENUM ('CULTURAL', 'HISTORICAL', 'NATURAL', 'RELIGIOUS', 'MUSEUM', 'PARK', 'MARKET', 'ENTERTAINMENT', 'LANDMARK', 'OTHER');

-- CreateTable
CREATE TABLE "regions" (
    "id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "status" "LocationStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cities" (
    "id" UUID NOT NULL,
    "region_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "status" "LocationStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cities_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "cities_latitude_check" CHECK ("latitude" >= -90 AND "latitude" <= 90),
    CONSTRAINT "cities_longitude_check" CHECK ("longitude" >= -180 AND "longitude" <= 180)
);

-- CreateTable
CREATE TABLE "destinations" (
    "id" UUID NOT NULL,
    "city_id" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "short_description" VARCHAR(300) NOT NULL,
    "full_description" TEXT NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "travel_info" JSONB,
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "destinations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "destinations_latitude_check" CHECK ("latitude" >= -90 AND "latitude" <= 90),
    CONSTRAINT "destinations_longitude_check" CHECK ("longitude" >= -180 AND "longitude" <= 180)
);

-- CreateTable
CREATE TABLE "attractions" (
    "id" UUID NOT NULL,
    "destination_id" UUID NOT NULL,
    "name" VARCHAR(180) NOT NULL,
    "slug" VARCHAR(200) NOT NULL,
    "category" "AttractionCategory" NOT NULL,
    "description" TEXT NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "entrance_fee" DECIMAL(12,2),
    "currency" CHAR(3),
    "opening_info" JSONB,
    "contact_info" JSONB,
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "published_at" TIMESTAMP(3),
    "archived_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attractions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "attractions_latitude_check" CHECK ("latitude" >= -90 AND "latitude" <= 90),
    CONSTRAINT "attractions_longitude_check" CHECK ("longitude" >= -180 AND "longitude" <= 180),
    CONSTRAINT "attractions_entrance_fee_check" CHECK ("entrance_fee" IS NULL OR "entrance_fee" >= 0),
    CONSTRAINT "attractions_currency_required_when_fee_check" CHECK ("entrance_fee" IS NULL OR "currency" IS NOT NULL),
    CONSTRAINT "attractions_currency_format_check" CHECK ("currency" IS NULL OR "currency" ~ '^[A-Z]{3}$')
);

-- CreateIndex
CREATE UNIQUE INDEX "regions_slug_key" ON "regions"("slug");
CREATE INDEX "regions_status_idx" ON "regions"("status");
CREATE INDEX "regions_name_idx" ON "regions"("name");

CREATE UNIQUE INDEX "cities_region_id_slug_key" ON "cities"("region_id", "slug");
CREATE INDEX "cities_region_id_idx" ON "cities"("region_id");
CREATE INDEX "cities_status_idx" ON "cities"("status");
CREATE INDEX "cities_name_idx" ON "cities"("name");
CREATE INDEX "cities_latitude_longitude_idx" ON "cities"("latitude", "longitude");

CREATE UNIQUE INDEX "destinations_city_id_slug_key" ON "destinations"("city_id", "slug");
CREATE INDEX "destinations_city_id_idx" ON "destinations"("city_id");
CREATE INDEX "destinations_status_idx" ON "destinations"("status");
CREATE INDEX "destinations_name_idx" ON "destinations"("name");
CREATE INDEX "destinations_latitude_longitude_idx" ON "destinations"("latitude", "longitude");

CREATE UNIQUE INDEX "attractions_destination_id_slug_key" ON "attractions"("destination_id", "slug");
CREATE INDEX "attractions_destination_id_idx" ON "attractions"("destination_id");
CREATE INDEX "attractions_category_idx" ON "attractions"("category");
CREATE INDEX "attractions_status_idx" ON "attractions"("status");
CREATE INDEX "attractions_name_idx" ON "attractions"("name");
CREATE INDEX "attractions_latitude_longitude_idx" ON "attractions"("latitude", "longitude");

-- AddForeignKey
ALTER TABLE "cities" ADD CONSTRAINT "cities_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "destinations" ADD CONSTRAINT "destinations_city_id_fkey" FOREIGN KEY ("city_id") REFERENCES "cities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "attractions" ADD CONSTRAINT "attractions_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
