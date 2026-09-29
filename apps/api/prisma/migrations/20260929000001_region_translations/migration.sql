-- CreateTable
CREATE TABLE "region_translations" (
    "id" UUID NOT NULL,
    "region_id" UUID NOT NULL,
    "locale" "EditorialLocale" NOT NULL,
    "display_name" VARCHAR(160),
    "description" TEXT,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "region_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "region_translations_locale_is_published_idx" ON "region_translations"("locale", "is_published");

-- CreateIndex
CREATE UNIQUE INDEX "region_translations_region_id_locale_key" ON "region_translations"("region_id", "locale");

-- AddForeignKey
ALTER TABLE "region_translations" ADD CONSTRAINT "region_translations_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
