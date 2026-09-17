-- Phase 14B: stable technical families for database-managed service categories.
-- Existing category IDs and Service category assignments remain unchanged.

-- CreateEnum
CREATE TYPE "ServiceCategoryFamily" AS ENUM (
    'ACCOMMODATION',
    'RESTAURANT',
    'TOUR',
    'TRANSPORT',
    'OTHER'
);

-- AlterTable
ALTER TABLE "service_categories"
ADD COLUMN "family" "ServiceCategoryFamily" NOT NULL DEFAULT 'OTHER';

-- Map only unambiguous canonical service categories. All other existing rows
-- deliberately retain the safe OTHER default.
UPDATE "service_categories"
SET "family" = CASE "code"
    WHEN 'ROOM' THEN 'ACCOMMODATION'::"ServiceCategoryFamily"
    WHEN 'MEAL' THEN 'RESTAURANT'::"ServiceCategoryFamily"
    WHEN 'TOUR' THEN 'TOUR'::"ServiceCategoryFamily"
    WHEN 'TRANSFER' THEN 'TRANSPORT'::"ServiceCategoryFamily"
    ELSE "family"
END
WHERE "code" IN ('ROOM', 'MEAL', 'TOUR', 'TRANSFER');
