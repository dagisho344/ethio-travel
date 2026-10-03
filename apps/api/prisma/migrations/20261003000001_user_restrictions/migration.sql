-- CreateEnum
CREATE TYPE "UserRestrictionCapability" AS ENUM ('BOOKING', 'REVIEW', 'MESSAGING', 'BUSINESS_MANAGEMENT', 'PAYMENT_PROOF_SUBMISSION');

-- CreateTable
CREATE TABLE "user_restrictions" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "capability" "UserRestrictionCapability" NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "restricted_by_user_id" UUID NOT NULL,
    "restricted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3),
    "lifted_at" TIMESTAMP(3),
    "lifted_by_user_id" UUID,
    "lift_reason" VARCHAR(1000),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_restrictions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_restrictions_user_id_capability_key" ON "user_restrictions"("user_id", "capability");

-- AddForeignKey
ALTER TABLE "user_restrictions" ADD CONSTRAINT "user_restrictions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_restrictions" ADD CONSTRAINT "user_restrictions_restricted_by_user_id_fkey" FOREIGN KEY ("restricted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_restrictions" ADD CONSTRAINT "user_restrictions_lifted_by_user_id_fkey" FOREIGN KEY ("lifted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
