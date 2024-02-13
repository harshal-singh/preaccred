CREATE TABLE "public"."Faculty" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" text NOT NULL, "gender" text NOT NULL, "phone" text NOT NULL, "email_id" text NOT NULL, "dob" date NOT NULL, "pan_card_no" text NOT NULL, "address" text NOT NULL, "cast" text NOT NULL, "minority" text NOT NULL, "qualification" text NOT NULL, "experience" text NOT NULL, "designation" text NOT NULL, "date_of_joining" date NOT NULL, "staff_type" text NOT NULL, "section" text NOT NULL, "status_of_approval" text NOT NULL, "job_type" text NOT NULL, "institute_id" uuid NOT NULL, "createdById" uuid NOT NULL, "updatedById" uuid NOT NULL, "created_at" timestamptz NOT NULL DEFAULT now(), "updated_at" timestamptz NOT NULL DEFAULT now(), "status" text NOT NULL, "cursorId" text NOT NULL, PRIMARY KEY ("id") );
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
CREATE TRIGGER "set_public_Faculty_updated_at"
BEFORE UPDATE ON "public"."Faculty"
FOR EACH ROW
EXECUTE PROCEDURE "public"."set_current_timestamp_updated_at"();
COMMENT ON TRIGGER "set_public_Faculty_updated_at" ON "public"."Faculty"
IS 'trigger to set value of column "updated_at" to current timestamp on row update';
CREATE EXTENSION IF NOT EXISTS pgcrypto;
