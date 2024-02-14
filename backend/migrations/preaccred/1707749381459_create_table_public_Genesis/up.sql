CREATE TABLE "public"."Genesis" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" text NOT NULL, "phoneNo" text NOT NULL, "emailId" text NOT NULL, "role" text NOT NULL DEFAULT 'ADMIN', "isVerified" boolean NOT NULL DEFAULT false, "createdAt" timestamp NOT NULL DEFAULT now(), "updatedAt" timestamp NOT NULL DEFAULT now(), PRIMARY KEY ("id") , UNIQUE ("emailId"), UNIQUE ("phoneNo"));
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
CREATE TRIGGER "set_public_Genesis_updatedAt"
BEFORE UPDATE ON "public"."Genesis"
FOR EACH ROW
EXECUTE PROCEDURE "public"."set_current_timestamp_updatedAt"();
COMMENT ON TRIGGER "set_public_Genesis_updatedAt" ON "public"."Genesis"
IS 'trigger to set value of column "updatedAt" to current timestamp on row update';
CREATE EXTENSION IF NOT EXISTS pgcrypto;
