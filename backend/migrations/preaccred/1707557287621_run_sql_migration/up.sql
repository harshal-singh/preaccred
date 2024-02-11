CREATE TABLE "public"."STATUS" ("value" text NOT NULL, PRIMARY KEY ("value") , UNIQUE ("value"));

INSERT INTO "public"."STATUS"("value") VALUES (E'ACTIVE');
INSERT INTO "public"."STATUS"("value") VALUES (E'INACTIVE');
INSERT INTO "public"."STATUS"("value") VALUES (E'DELETED');

CREATE TABLE "public"."genesis" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "phone" text NOT NULL,
  "email_id" text NOT NULL,
  "role" text NOT NULL,
  "isVerified" text NOT NULL,
  "createdById" uuid NOT NULL,
  "updatedById" uuid,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "status" text NOT NULL DEFAULT 'ACTIVE',
  "cursorId" bigserial NOT NULL,
  PRIMARY KEY ("id") ,
  FOREIGN KEY ("status")
  REFERENCES "public"."STATUS"("value") ON UPDATE restrict ON DELETE restrict,
  UNIQUE ("cursorId"));
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
CREATE TRIGGER "set_public_genesis_updatedAt"
BEFORE UPDATE ON "public"."genesis"
FOR EACH ROW
EXECUTE PROCEDURE "public"."set_current_timestamp_updatedAt"();
COMMENT ON TRIGGER "set_public_genesis_updatedAt" ON "public"."genesis"
IS 'trigger to set value of column "updatedAt" to current timestamp on row update';
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE "public"."institute" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "website" text NOT NULL,
  "date_of_establishment" date NOT NULL,
  "type" text NOT NULL,
  "address" text NOT NULL,
  "landmark" text NOT NULL,
  "city" text NOT NULL,
  "state" text NOT NULL,
  "pin" text NOT NULL,
  "createdById" uuid NOT NULL,
  "updatedById" uuid,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "status" text NOT NULL DEFAULT 'ACTIVE',
  "cursorId" bigserial NOT NULL,
  PRIMARY KEY ("id") ,
  FOREIGN KEY ("status")
  REFERENCES "public"."STATUS"("value") ON UPDATE restrict ON DELETE restrict,
  UNIQUE ("cursorId"));
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
CREATE TRIGGER "set_public_institute_updatedAt"
BEFORE UPDATE ON "public"."institute"
FOR EACH ROW
EXECUTE PROCEDURE "public"."set_current_timestamp_updatedAt"();
COMMENT ON TRIGGER "set_public_institute_updatedAt" ON "public"."institute"
IS 'trigger to set value of column "updatedAt" to current timestamp on row update';
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE "public"."e_governance" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "description" text NOT NULL,
  "service_start_date" date NOT NULL,
  "service_end_date" date NOT NULL,
  "phone_no" text NOT NULL,
  "address" text NOT NULL,
  "website" text NOT NULL,
  "total_amount" text NOT NULL,
  "area" text NOT NULL,
  "file" text NOT NULL,
  "institute_id" uuid NOT NULL,
  "createdById" uuid NOT NULL,
  "updatedById" uuid,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "status" text NOT NULL DEFAULT 'ACTIVE',
  "cursorId" bigserial NOT NULL,
  PRIMARY KEY ("id") ,
  FOREIGN KEY ("status")
  REFERENCES "public"."STATUS"("value") ON UPDATE restrict ON DELETE restrict,
  FOREIGN KEY ("institute_id")
  REFERENCES "public"."institute"("id") ON UPDATE restrict ON DELETE restrict,
  UNIQUE ("cursorId"));
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
CREATE TRIGGER "set_public_e_governance_updatedAt"
BEFORE UPDATE ON "public"."e_governance"
FOR EACH ROW
EXECUTE PROCEDURE "public"."set_current_timestamp_updatedAt"();
COMMENT ON TRIGGER "set_public_e_governance_updatedAt" ON "public"."e_governance"
IS 'trigger to set value of column "updatedAt" to current timestamp on row update';
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE "public"."institute_funding" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "purpose" text NOT NULL,
  "type" text NOT NULL,
  "amount" text NOT NULL,
  "transaction_type" text NOT NULL,
  "transaction_date" date NOT NULL,
  "institute_id" uuid NOT NULL,
  "createdById" uuid NOT NULL,
  "updatedById" uuid,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "status" text NOT NULL DEFAULT 'ACTIVE',
  "cursorId" bigserial NOT NULL,
  PRIMARY KEY ("id") ,
  FOREIGN KEY ("status")
  REFERENCES "public"."STATUS"("value") ON UPDATE restrict ON DELETE restrict,
  FOREIGN KEY ("institute_id")
  REFERENCES "public"."institute"("id") ON UPDATE restrict ON DELETE restrict,
  UNIQUE ("cursorId"));
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
CREATE TRIGGER "set_public_institute_funding_updatedAt"
BEFORE UPDATE ON "public"."institute_funding"
FOR EACH ROW
EXECUTE PROCEDURE "public"."set_current_timestamp_updatedAt"();
COMMENT ON TRIGGER "set_public_institute_funding_updatedAt" ON "public"."institute_funding"
IS 'trigger to set value of column "updatedAt" to current timestamp on row update';
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE "public"."faculty" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "gender" text NOT NULL,
  "phone" text NOT NULL,
  "email_id" text NOT NULL,
  "dob" date,
  "pan_card_no" text,
  "address" text,
  "cast" text,
  "minority" text,
  "qualification" text NOT NULL,
  "experience" text NOT NULL,
  "designation" text NOT NULL,
  "date_of_joining" date NOT NULL,
  "staff_type" text NOT NULL,
  "section" text,
  "status_of_approval" text NOT NULL,
  "job_type" text NOT NULL,
  "institute_id" uuid NOT NULL,
  "createdById" uuid NOT NULL,
  "updatedById" uuid,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "status" text NOT NULL DEFAULT 'ACTIVE',
  "cursorId" bigserial NOT NULL,
  PRIMARY KEY ("id") ,
  FOREIGN KEY ("status")
  REFERENCES "public"."STATUS"("value") ON UPDATE restrict ON DELETE restrict,
  FOREIGN KEY ("institute_id")
  REFERENCES "public"."institute"("id") ON UPDATE restrict ON DELETE restrict,
  UNIQUE ("cursorId"));
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
CREATE TRIGGER "set_public_faculty_updatedAt"
BEFORE UPDATE ON "public"."faculty"
FOR EACH ROW
EXECUTE PROCEDURE "public"."set_current_timestamp_updatedAt"();
COMMENT ON TRIGGER "set_public_faculty_updatedAt" ON "public"."faculty"
IS 'trigger to set value of column "updatedAt" to current timestamp on row update';
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE "public"."fdp_pdp" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "description" text NOT NULL,
  "date_from" date NOT NULL,
  "date_to" date NOT NULL,
  "nature" text NOT NULL,
  "venue" text NOT NULL,
  "file" text NOT NULL,
  "type" text NOT NULL,
  "faculty_id" uuid NOT NULL,
  "institute_id" uuid NOT NULL,
  "createdById" uuid NOT NULL,
  "updatedById" uuid,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "status" text NOT NULL DEFAULT 'ACTIVE',
  "cursorId" bigserial NOT NULL,
  PRIMARY KEY ("id") ,
  FOREIGN KEY ("status")
  REFERENCES "public"."STATUS"("value") ON UPDATE restrict ON DELETE restrict,
  FOREIGN KEY ("institute_id")
  REFERENCES "public"."institute"("id") ON UPDATE restrict ON DELETE restrict,
  FOREIGN KEY ("faculty_id")
  REFERENCES "public"."faculty"("id") ON UPDATE restrict ON DELETE restrict,
  UNIQUE ("cursorId"));
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
CREATE TRIGGER "set_public_fdp_pdp_updatedAt"
BEFORE UPDATE ON "public"."fdp_pdp"
FOR EACH ROW
EXECUTE PROCEDURE "public"."set_current_timestamp_updatedAt"();
COMMENT ON TRIGGER "set_public_fdp_pdp_updatedAt" ON "public"."fdp_pdp"
IS 'trigger to set value of column "updatedAt" to current timestamp on row update';
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE "public"."faculty_funding" (
  "id" uuid NOT NULL DEFAULT gen_random_uuid(),
  "nature" text NOT NULL,
  "type" text NOT NULL,
  "amount" text NOT NULL,
  "transaction_type" text NOT NULL,
  "transaction_date" date NOT NULL,
  "file" text NOT NULL,
  "faculty_id" uuid NOT NULL,
  "institute_id" uuid NOT NULL,
  "createdById" uuid NOT NULL,
  "updatedById" uuid,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  "status" text NOT NULL DEFAULT 'ACTIVE',
  "cursorId" bigserial NOT NULL,
  PRIMARY KEY ("id") ,
  FOREIGN KEY ("status")
  REFERENCES "public"."STATUS"("value") ON UPDATE restrict ON DELETE restrict,
  FOREIGN KEY ("institute_id")
  REFERENCES "public"."institute"("id") ON UPDATE restrict ON DELETE restrict,
  FOREIGN KEY ("faculty_id")
  REFERENCES "public"."faculty"("id") ON UPDATE restrict ON DELETE restrict,
  UNIQUE ("cursorId"));
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
CREATE TRIGGER "set_public_faculty_funding_updatedAt"
BEFORE UPDATE ON "public"."faculty_funding"
FOR EACH ROW
EXECUTE PROCEDURE "public"."set_current_timestamp_updatedAt"();
COMMENT ON TRIGGER "set_public_faculty_funding_updatedAt" ON "public"."faculty_funding"
IS 'trigger to set value of column "updatedAt" to current timestamp on row update';
CREATE EXTENSION IF NOT EXISTS pgcrypto;
