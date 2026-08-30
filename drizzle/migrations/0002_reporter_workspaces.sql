-- ReliefOps reporter workspaces
--
-- This migration is intentionally idempotent because the project documents
-- applying SQL artifacts directly in Neon. Existing cases are backfilled with
-- their original session deadline; no historical case is assigned to a
-- workspace without proving ownership through its legacy cookie.

CREATE TABLE IF NOT EXISTS "reporter_workspaces" (
  "id"         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  "token_hash" text        NOT NULL UNIQUE,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "expires_at" timestamptz NOT NULL,
  "revoked_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "reporter_workspaces_expires_at_idx"
  ON "reporter_workspaces" ("expires_at");

-- Expiry is a security boundary, not a sliding session field. Prevent any
-- future code (or an administrative update) from extending or shortening a
-- workspace after it has been issued. Revocation remains independently
-- mutable through revoked_at.
CREATE OR REPLACE FUNCTION "reliefops_prevent_workspace_expiry_change"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW."expires_at" IS DISTINCT FROM OLD."expires_at" THEN
    RAISE EXCEPTION 'reporter workspace expiry is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "reporter_workspaces_expiry_immutable"
  ON "reporter_workspaces";

CREATE TRIGGER "reporter_workspaces_expiry_immutable"
BEFORE UPDATE OF "expires_at" ON "reporter_workspaces"
FOR EACH ROW
EXECUTE FUNCTION "reliefops_prevent_workspace_expiry_change"();

ALTER TABLE "relief_cases"
  ADD COLUMN IF NOT EXISTS "reporter_workspace_id" uuid;

ALTER TABLE "relief_cases"
  ADD COLUMN IF NOT EXISTS "reporter_session_expires_at" timestamptz;

-- A case's deadline is based on the original first-message receive time, not
-- migration time. This preserves already-expired sessions as expired.
UPDATE "relief_cases"
SET "reporter_session_expires_at" = "session_started_at" + INTERVAL '10 hours'
WHERE "reporter_session_expires_at" IS NULL;

ALTER TABLE "relief_cases"
  ALTER COLUMN "reporter_session_expires_at" SET NOT NULL;

DO $$ BEGIN
  ALTER TABLE "relief_cases"
    ADD CONSTRAINT "relief_cases_reporter_workspace_fk"
    FOREIGN KEY ("reporter_workspace_id")
    REFERENCES "reporter_workspaces"("id")
    ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "relief_cases_reporter_workspace_id_idx"
  ON "relief_cases" ("reporter_workspace_id");

CREATE INDEX IF NOT EXISTS "relief_cases_reporter_session_expires_at_idx"
  ON "relief_cases" ("reporter_session_expires_at");

CREATE INDEX IF NOT EXISTS "relief_cases_updated_at_idx"
  ON "relief_cases" ("updated_at");

CREATE INDEX IF NOT EXISTS "messages_case_created_at_id_idx"
  ON "messages" ("case_id", "created_at", "id");

-- Keep updated_at useful as the history last-activity timestamp for every
-- message sender, including coordinator replies. The trigger executes inside
-- the same transaction as the insert and never extends reporter expiry.
CREATE OR REPLACE FUNCTION "reliefops_touch_case_activity"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE "relief_cases"
  SET "updated_at" = GREATEST("updated_at", NEW."created_at")
  WHERE "id" = NEW."case_id";
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "messages_touch_case_activity"
  ON "messages";

CREATE TRIGGER "messages_touch_case_activity"
AFTER INSERT ON "messages"
FOR EACH ROW
EXECUTE FUNCTION "reliefops_touch_case_activity"();
