-- Phase 13C: additive, typed, non-secret platform settings singleton.
-- This does not modify existing traveler, business, booking, payment, or audit data.

-- CreateTable
CREATE TABLE "platform_settings" (
    "id" UUID NOT NULL,
    "singleton_key" VARCHAR(32) NOT NULL DEFAULT 'PRIMARY',
    "support_email" VARCHAR(254),
    "support_phone" VARCHAR(50),
    "support_message" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_settings_singleton_key_key" ON "platform_settings"("singleton_key");
