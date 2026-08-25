-- ReliefOps initial migration
-- Generated for Phase 2: creates all six tables and their supporting enums.
-- Run via: DATABASE_URL_UNPOOLED=<url> pnpm drizzle-kit migrate

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE "role" AS ENUM ('COORDINATOR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "case_status" AS ENUM ('INTAKE', 'REVIEW', 'ACTIVE', 'CLOSED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "chat_mode" AS ENUM ('AI', 'HUMAN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "urgency_level" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "sender_type" AS ENUM ('REPORTER', 'AI', 'COORDINATOR');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "assessment_source" AS ENUM ('AI', 'HUMAN');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "task_status" AS ENUM ('TODO', 'DOING', 'DONE');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "audit_status" AS ENUM ('PENDING', 'ANCHORED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "audit_event_type" AS ENUM ('CHAT_STARTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "profiles" (
  "user_id"      text        PRIMARY KEY,
  "role"         "role"      NOT NULL DEFAULT 'COORDINATOR',
  "display_name" text        NOT NULL
);

-- ---------------------------------------------------------------------------
-- relief_cases
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "relief_cases" (
  "id"                      uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  "public_ref"              text          NOT NULL UNIQUE,
  "session_token_hash"      text          NOT NULL,
  "session_started_at"      timestamptz   NOT NULL,
  "status"                  "case_status" NOT NULL DEFAULT 'INTAKE',
  "chat_mode"               "chat_mode"   NOT NULL DEFAULT 'AI',
  "facts"                   json,
  "human_urgency"           "urgency_level",
  "assigned_coordinator_id" text          REFERENCES "profiles"("user_id"),
  "created_at"              timestamptz   NOT NULL DEFAULT now(),
  "updated_at"              timestamptz   NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- messages
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "messages" (
  "id"             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  "case_id"        uuid          NOT NULL REFERENCES "relief_cases"("id"),
  "sender_type"    "sender_type" NOT NULL,
  "sender_user_id" text,
  "body"           text          NOT NULL,
  "ai_metadata"    json,
  "created_at"     timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "messages_case_id_idx" ON "messages" ("case_id");

-- ---------------------------------------------------------------------------
-- urgency_assessments
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "urgency_assessments" (
  "id"                   uuid                 PRIMARY KEY DEFAULT gen_random_uuid(),
  "case_id"              uuid                 NOT NULL REFERENCES "relief_cases"("id"),
  "source"               "assessment_source"  NOT NULL,
  "urgency_level"        "urgency_level"      NOT NULL,
  "factor_breakdown"     json                 NOT NULL,
  "confidence"           text,
  "missing_information"  json,
  "rationale"            text                 NOT NULL,
  "model_version"        text,
  "human_actor_id"       text,
  "created_at"           timestamptz          NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "urgency_assessments_case_id_idx" ON "urgency_assessments" ("case_id");

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "tasks" (
  "id"             uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  "case_id"        uuid          NOT NULL REFERENCES "relief_cases"("id"),
  "title"          text          NOT NULL,
  "details"        text,
  "position"       integer       NOT NULL,
  "proposed_owner" text,
  "status"         "task_status" NOT NULL DEFAULT 'TODO',
  "approved"       boolean       NOT NULL DEFAULT false,
  "created_at"     timestamptz   NOT NULL DEFAULT now(),
  "updated_at"     timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "tasks_case_id_idx" ON "tasks" ("case_id");

-- ---------------------------------------------------------------------------
-- audit_records
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "audit_records" (
  "audit_id"                uuid                 PRIMARY KEY DEFAULT gen_random_uuid(),
  "case_id"                 uuid                 NOT NULL REFERENCES "relief_cases"("id"),
  "event_type"              "audit_event_type"   NOT NULL,
  "payload"                 json                 NOT NULL,
  "nonce"                   text                 NOT NULL,
  "record_hash"             text                 NOT NULL,
  "stellar_tx_hash"         text,
  "status"                  "audit_status"       NOT NULL DEFAULT 'PENDING',
  "error_message"           text,
  "first_message_at"        timestamptz          NOT NULL,
  "stellar_ledger_sequence" integer,
  "ledger_close_time"       timestamptz,
  "anchored_at"             timestamptz,
  CONSTRAINT "audit_records_case_event_unique" UNIQUE ("case_id", "event_type")
);

CREATE INDEX IF NOT EXISTS "audit_records_case_id_idx" ON "audit_records" ("case_id");
