CREATE TABLE "public"."E_governance" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" text NOT NULL, "description" text NOT NULL, "service_start_date" date NOT NULL, "service_end_date" date NOT NULL, "phone_no" text NOT NULL, "address" text NOT NULL, "website" text NOT NULL, "total_amount" text NOT NULL, "area" text NOT NULL, "file" text NOT NULL, "institute_id" uuid NOT NULL, "createdById" uuid NOT NULL, "updatedById" uuid NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "status" text NOT NULL, "cursorId" text NOT NULL, PRIMARY KEY ("id") );
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
CREATE TRIGGER "set_public_E_governance_updated_at"
BEFORE UPDATE ON "public"."E_governance"
FOR EACH ROW
EXECUTE PROCEDURE "public"."set_current_timestamp_updated_at"();
COMMENT ON TRIGGER "set_public_E_governance_updated_at" ON "public"."E_governance"
IS 'trigger to set value of column "updated_at" to current timestamp on row update';
CREATE EXTENSION IF NOT EXISTS pgcrypto;
