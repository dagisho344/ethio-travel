-- CreateEnum
CREATE TYPE "EditorialLocale" AS ENUM ('en', 'am');

-- CreateTable
CREATE TABLE "destination_translations" (
    "id" UUID NOT NULL,
    "destination_id" UUID NOT NULL,
    "locale" "EditorialLocale" NOT NULL,
    "display_name" VARCHAR(180),
    "short_description" VARCHAR(300),
    "full_description" TEXT,
    "best_time_to_visit" VARCHAR(1000),
    "getting_there" VARCHAR(1000),
    "local_tips" VARCHAR(1000),
    "safety_notes" VARCHAR(1000),
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "destination_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "destination_translations_destination_id_locale_key" ON "destination_translations"("destination_id", "locale");

-- CreateIndex
CREATE INDEX "destination_translations_locale_is_published_idx" ON "destination_translations"("locale", "is_published");

-- AddForeignKey
ALTER TABLE "destination_translations" ADD CONSTRAINT "destination_translations_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "destinations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
