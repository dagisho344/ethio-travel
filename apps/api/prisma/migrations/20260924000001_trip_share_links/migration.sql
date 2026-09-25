-- CreateTable
CREATE TABLE "trip_shares" (
    "id" UUID NOT NULL,
    "trip_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3),
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "trip_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "trip_shares_trip_id_key" ON "trip_shares"("trip_id");

-- CreateIndex
CREATE UNIQUE INDEX "trip_shares_token_hash_key" ON "trip_shares"("token_hash");

-- AddForeignKey
ALTER TABLE "trip_shares" ADD CONSTRAINT "trip_shares_trip_id_fkey" FOREIGN KEY ("trip_id") REFERENCES "trips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
