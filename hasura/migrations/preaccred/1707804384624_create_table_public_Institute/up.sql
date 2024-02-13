CREATE TABLE "public"."Institute" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" text NOT NULL, "website" text NOT NULL, "date_of_establishment" date NOT NULL, "type" text NOT NULL, "address" text NOT NULL, "landmark" text NOT NULL, "city" text NOT NULL, "state" text NOT NULL, "pin" text NOT NULL, "created_by_id" uuid NOT NULL, "updated_by_id" uuid NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "cursor_id" text NOT NULL, PRIMARY KEY ("id") );
CREATE OR REPLACE FUNCTION "public"."set_current_timestamp_updated_at"()
RETURNS TRIGGER AS $$
DECLARE
  _new record;
BEGIN
  _new := NEW;
  _new."updated_at" = NOW();
  RETURN _new;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "set_public_Institute_updated_at"
BEFORE UPDATE ON "public"."Institute"
FOR EACH ROW
EXECUTE PROCEDURE "public"."set_current_timestamp_updated_at"();
COMMENT ON TRIGGER "set_public_Institute_updated_at" ON "public"."Institute"
IS 'trigger to set value of column "updated_at" to current timestamp on row update';
CREATE EXTENSION IF NOT EXISTS pgcrypto;
