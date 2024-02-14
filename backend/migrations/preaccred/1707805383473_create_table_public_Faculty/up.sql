CREATE TABLE "public"."Faculty" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" text NOT NULL, "gender" text NOT NULL, "phoneNo" text NOT NULL, "emailId" text NOT NULL, "dob" date NOT NULL, "panCardNo" text NOT NULL, "address" text NOT NULL, "cast" text NOT NULL, "minority" text NOT NULL, "qualification" text NOT NULL, "experience" text NOT NULL, "designation" text NOT NULL, "dateOfJoining" date NOT NULL, "staffType" text NOT NULL, "section" text NOT NULL, "statusOfApproval" text NOT NULL, "jobType" text NOT NULL, "instituteId" uuid NOT NULL, "createdById" uuid NOT NULL, "updatedById" uuid NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), "status" text NOT NULL DEFAULT "ACTIVE", "isVerified" boolean NOT NULL DEFAULT false, "cursorId" bigserial  not null unique, PRIMARY KEY ("id"), FOREIGN KEY ("status") REFERENCES "public"."Status"("value") ON UPDATE restrict ON DELETE restrict);
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
CREATE TRIGGER "set_public_Faculty_updatedAt"
BEFORE UPDATE ON "public"."Faculty"
FOR EACH ROW
EXECUTE PROCEDURE "public"."set_current_timestamp_updatedAt"();
COMMENT ON TRIGGER "set_public_Faculty_updatedAt" ON "public"."Faculty"
IS 'trigger to set value of column "updatedAt" to current timestamp on row update';
CREATE EXTENSION IF NOT EXISTS pgcrypto;
