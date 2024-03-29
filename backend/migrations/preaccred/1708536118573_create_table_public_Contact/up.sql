CREATE TABLE "public"."Contact" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" text NOT NULL, "phoneNo" text NOT NULL, "primaryEmailId" text NOT NULL, "secondaryEmailId" text NOT NULL, "collegeName" text NOT NULL, "createdById" uuid NOT NULL, "updatedById" uuid, "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now(), "status" text NOT NULL DEFAULT 'ACTIVE', "isVerified" boolean NOT NULL DEFAULT false, "cursorId" bigserial NOT NULL, "instituteId" uuid, PRIMARY KEY ("id") );
CREATE OR REPLACE FUNCTION "public"."set_current_timestamp_updatedAt"()
RETURNS TRIGGER AS $$
DECLARE
  _new record;
BEGIN
  _new := NEW;
  _new."updatedAt" = NOW();
  RETURN _new;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "set_public_Contact_updatedAt"
BEFORE UPDATE ON "public"."Contact"
FOR EACH ROW
EXECUTE PROCEDURE "public"."set_current_timestamp_updatedAt"();
COMMENT ON TRIGGER "set_public_Contact_updatedAt" ON "public"."Contact"
IS 'trigger to set value of column "updatedAt" to current timestamp on row update';
CREATE EXTENSION IF NOT EXISTS pgcrypto;
