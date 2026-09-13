-- Phase 12C: additive verification document upload/finalization lifecycle.
-- Existing verification history and document references are preserved.

ALTER TYPE "VerificationRequestStatus" ADD VALUE IF NOT EXISTS 'DRAFT';

-- A DRAFT has not been submitted. Existing historical submitted timestamps stay intact.
ALTER TABLE "business_verifications"
  ALTER COLUMN "submitted_at" DROP DEFAULT,
  ALTER COLUMN "submitted_at" DROP NOT NULL;

ALTER TABLE "verification_documents"
  ADD COLUMN "status" "MediaStatus" NOT NULL DEFAULT 'READY',
  ADD COLUMN "uploaded_by_user_id" UUID,
  ADD COLUMN "finalized_at" TIMESTAMP(3),
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "verification_documents"
  ADD CONSTRAINT "verification_documents_uploaded_by_user_id_fkey"
  FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A DRAFT has submitted_at NULL; historical submitted requests retain their timestamp.
CREATE UNIQUE INDEX "business_verifications_one_draft_per_business"
  ON "business_verifications"("business_id")
  WHERE "submitted_at" IS NULL;
CREATE INDEX "verification_documents_status_idx" ON "verification_documents"("status");
CREATE INDEX "verification_documents_uploaded_by_user_id_idx" ON "verification_documents"("uploaded_by_user_id");