-- The old role-only index prevents retaining archived HERO attachments.
-- A joined MediaAsset status cannot be referenced by a partial-index predicate.
-- Both triggers lock the parent Destination before checking the shared invariant.
CREATE FUNCTION "check_destination_active_hero"() RETURNS trigger AS $$
DECLARE
  checked_destination_id UUID;
BEGIN
  IF TG_TABLE_NAME = 'destination_media' THEN
    IF NEW."role" <> 'HERO' THEN
      RETURN NEW;
    END IF;
    checked_destination_id := NEW."destination_id";
    PERFORM 1 FROM "destinations" WHERE "id" = checked_destination_id FOR UPDATE;
    IF (
      SELECT COUNT(*)
      FROM "destination_media" AS attachment
      JOIN "media_assets" AS asset ON asset."id" = attachment."media_id"
      WHERE attachment."destination_id" = checked_destination_id
        AND attachment."role" = 'HERO'
        AND asset."status" <> 'ARCHIVED'
    ) > 1 THEN
      RAISE EXCEPTION 'A destination may have only one non-archived HERO attachment.'
        USING ERRCODE = '23505';
    END IF;
  ELSE
    FOR checked_destination_id IN
      SELECT DISTINCT attachment."destination_id"
      FROM "destination_media" AS attachment
      WHERE attachment."media_id" = NEW."id" AND attachment."role" = 'HERO'
      ORDER BY attachment."destination_id"
    LOOP
      PERFORM 1 FROM "destinations" WHERE "id" = checked_destination_id FOR UPDATE;
      IF (
        SELECT COUNT(*)
        FROM "destination_media" AS attachment
        JOIN "media_assets" AS asset ON asset."id" = attachment."media_id"
        WHERE attachment."destination_id" = checked_destination_id
          AND attachment."role" = 'HERO'
          AND asset."status" <> 'ARCHIVED'
      ) > 1 THEN
        RAISE EXCEPTION 'A destination may have only one non-archived HERO attachment.'
          USING ERRCODE = '23505';
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "destination_media_active_hero_check"
AFTER INSERT OR UPDATE OF "destination_id", "media_id", "role" ON "destination_media"
FOR EACH ROW EXECUTE FUNCTION "check_destination_active_hero"();

CREATE TRIGGER "media_assets_active_destination_hero_check"
AFTER UPDATE OF "status" ON "media_assets"
FOR EACH ROW
WHEN (OLD."status" IS DISTINCT FROM NEW."status" AND NEW."status" <> 'ARCHIVED')
EXECUTE FUNCTION "check_destination_active_hero"();

-- Trigger checks are installed before relaxing the old, overly broad index.
DROP INDEX "destination_media_one_hero";
