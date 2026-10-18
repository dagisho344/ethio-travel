-- Add a nullable description to preserve existing disabled configuration rows.
-- A description is required only when the request offer is enabled.
ALTER TABLE "destination_booking_configs"
  ADD COLUMN "request_description" VARCHAR(1000);

ALTER TABLE "destination_booking_configs"
  ADD CONSTRAINT "destination_booking_configs_enabled_description_check"
  CHECK (
    NOT "booking_enabled"
    OR (
      "request_description" IS NOT NULL
      AND length(btrim("request_description")) >= 10
    )
  );
