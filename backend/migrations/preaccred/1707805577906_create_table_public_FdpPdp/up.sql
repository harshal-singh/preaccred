CREATE TABLE "public"."FdpPdp" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "name" text NOT NULL, "description" text NOT NULL, "dateFrom" date NOT NULL, "dateTo" date NOT NULL, "nature" text NOT NULL, "venue" text NOT NULL, "file" text NOT NULL, "type" text NOT NULL, "facultyId" uuid NOT NULL, "instituteId" uuid NOT NULL, "createdById" uuid NOT NULL, "updatedById" uuid NOT NULL, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), "status" text NOT NULL DEFAULT "ACTIVE", "cursorId" bigserial  not null unique, PRIMARY KEY ("id"), FOREIGN KEY ("status") REFERENCES "public"."Status"("value") ON UPDATE restrict ON DELETE restrict);
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
CREATE TRIGGER "set_public_FdpPdp_updatedAt"
BEFORE UPDATE ON "public"."FdpPdp"
FOR EACH ROW
EXECUTE PROCEDURE "public"."set_current_timestamp_updatedAt"();
COMMENT ON TRIGGER "set_public_FdpPdp_updatedAt" ON "public"."FdpPdp"
IS 'trigger to set value of column "updatedAt" to current timestamp on row update';
CREATE EXTENSION IF NOT EXISTS pgcrypto;
