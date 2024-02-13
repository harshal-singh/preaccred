CREATE TABLE "public"."Genesis" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" text NOT NULL, "phone" text NOT NULL, "email_id" text NOT NULL, "role" text NOT NULL DEFAULT 'ADMIN', "is_verified" boolean NOT NULL DEFAULT false, "created_at" timestamp NOT NULL DEFAULT now(), "updated_at" timestamp NOT NULL DEFAULT now(), PRIMARY KEY ("id") , UNIQUE ("email_id"), UNIQUE ("phone"));
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
CREATE TRIGGER "set_public_Genesis_updated_at"
BEFORE UPDATE ON "public"."Genesis"
FOR EACH ROW
EXECUTE PROCEDURE "public"."set_current_timestamp_updated_at"();
COMMENT ON TRIGGER "set_public_Genesis_updated_at" ON "public"."Genesis"
IS 'trigger to set value of column "updated_at" to current timestamp on row update';
CREATE EXTENSION IF NOT EXISTS pgcrypto;
