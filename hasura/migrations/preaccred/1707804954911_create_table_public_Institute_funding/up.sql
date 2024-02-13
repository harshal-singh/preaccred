CREATE TABLE "public"."Institute_funding" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" text NOT NULL, "purpose" text NOT NULL, "type" text NOT NULL, "amount" text NOT NULL, "transaction_type" text NOT NULL, "transaction_date" date NOT NULL, "institute_id" uuid NOT NULL, "createdById" uuid NOT NULL, "updatedById" uuid NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "status" text NOT NULL, "cursorId" text NOT NULL, PRIMARY KEY ("id") );
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
CREATE TRIGGER "set_public_Institute_funding_updated_at"
BEFORE UPDATE ON "public"."Institute_funding"
FOR EACH ROW
EXECUTE PROCEDURE "public"."set_current_timestamp_updated_at"();
COMMENT ON TRIGGER "set_public_Institute_funding_updated_at" ON "public"."Institute_funding"
IS 'trigger to set value of column "updated_at" to current timestamp on row update';
CREATE EXTENSION IF NOT EXISTS pgcrypto;
