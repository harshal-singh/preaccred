CREATE TABLE "public"."InstituteFunding" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" text NOT NULL, "purpose" text NOT NULL, "type" text NOT NULL, "amount" text NOT NULL, "transactionType" text NOT NULL, "transactionDate" date NOT NULL, "instituteId" uuid NOT NULL, "createdById" uuid NOT NULL, "updatedById" uuid NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), "status" text NOT NULL DEFAULT "ACTIVE", "cursorId" bigserial  not null unique, PRIMARY KEY ("id"), FOREIGN KEY ("status") REFERENCES "public"."Status"("value") ON UPDATE restrict ON DELETE restrict);
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
CREATE TRIGGER "set_public_InstituteFunding_updatedAt"
BEFORE UPDATE ON "public"."InstituteFunding"
FOR EACH ROW
EXECUTE PROCEDURE "public"."set_current_timestamp_updatedAt"();
COMMENT ON TRIGGER "set_public_InstituteFunding_updatedAt" ON "public"."InstituteFunding"
IS 'trigger to set value of column "updatedAt" to current timestamp on row update';
CREATE EXTENSION IF NOT EXISTS pgcrypto;
