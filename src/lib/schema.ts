/**
 * src/lib/schema.ts — Drizzle ORM table definitions for all six ReliefOps tables.
 * Types are inferred; never import this in browser code.
 */
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  json,
  unique,
  index,
} from "drizzle-orm/pg-core";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const roleEnum = pgEnum("role", ["COORDINATOR"]);

export const caseStatusEnum = pgEnum("case_status", [
  "INTAKE",
  "REVIEW",
  "ACTIVE",
  "CLOSED",
]);

export const chatModeEnum = pgEnum("chat_mode", ["AI", "HUMAN"]);

export const urgencyLevelEnum = pgEnum("urgency_level", [
  "CRITICAL",
  "HIGH",
  "MEDIUM",
  "LOW",
]);

export const senderTypeEnum = pgEnum("sender_type", [
  "REPORTER",
  "AI",
  "COORDINATOR",
]);

export const assessmentSourceEnum = pgEnum("assessment_source", [
  "AI",
  "HUMAN",
]);

export const taskStatusEnum = pgEnum("task_status", ["TODO", "DOING", "DONE"]);

export const auditStatusEnum = pgEnum("audit_status", [
  "PENDING",
  "ANCHORED",
  "FAILED",
]);

export const auditEventTypeEnum = pgEnum("audit_event_type", ["CHAT_STARTED"]);

// ---------------------------------------------------------------------------
// profiles
// ---------------------------------------------------------------------------

export const profiles = pgTable("profiles", {
  /** Neon Auth user_id — links to the Neon Auth user record. */
  userId: text("user_id").primaryKey(),
  role: roleEnum("role").notNull().default("COORDINATOR"),
  displayName: text("display_name").notNull(),
});

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;

// ---------------------------------------------------------------------------
// reporter_workspaces
// ---------------------------------------------------------------------------

/**
 * Browser-bound, account-free reporter workspace.
 *
 * Only the HMAC of the HttpOnly cookie is stored. The expiry is deliberately
 * absolute: application code must never update it as a side effect of chat
 * activity.
 */
export const reporterWorkspaces = pgTable(
  "reporter_workspaces",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    /** HMAC-SHA-256(REPORTER_SESSION_PEPPER, workspace token). */
    tokenHash: text("token_hash").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [index("reporter_workspaces_expires_at_idx").on(t.expiresAt)]
);

export type ReporterWorkspace = typeof reporterWorkspaces.$inferSelect;
export type NewReporterWorkspace = typeof reporterWorkspaces.$inferInsert;

// ---------------------------------------------------------------------------
// relief_cases
// ---------------------------------------------------------------------------

export const reliefCases = pgTable("relief_cases", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Non-guessable short public reference (nanoid). */
  publicRef: text("public_ref").notNull().unique(),
  /** HMAC-SHA-256(REPORTER_SESSION_PEPPER, raw token) — never the raw token. */
  sessionTokenHash: text("session_token_hash").notNull(),
  /** Immutable — set from the first reporter message's server receive time. */
  sessionStartedAt: timestamp("session_started_at", {
    withTimezone: true,
  }).notNull(),
  /** Nullable during migration; set only after proving legacy cookie ownership. */
  reporterWorkspaceId: uuid("reporter_workspace_id").references(
    () => reporterWorkspaces.id,
    { onDelete: "set null" }
  ),
  /** Absolute reporter access deadline; activity never extends this value. */
  reporterSessionExpiresAt: timestamp("reporter_session_expires_at", {
    withTimezone: true,
  }).notNull(),
  status: caseStatusEnum("status").notNull().default("INTAKE"),
  chatMode: chatModeEnum("chat_mode").notNull().default("AI"),
  /** Structured facts JSON (CaseFactsPatch shape). */
  facts: json("facts"),
  /** Human urgency level, nullable until a coordinator assesses. */
  humanUrgency: urgencyLevelEnum("human_urgency"),
  /** Nullable FK to profiles.user_id */
  assignedCoordinatorId: text("assigned_coordinator_id").references(
    () => profiles.userId
  ),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
},
  (t) => [
    index("relief_cases_reporter_workspace_id_idx").on(t.reporterWorkspaceId),
    index("relief_cases_reporter_session_expires_at_idx").on(
      t.reporterSessionExpiresAt
    ),
    index("relief_cases_updated_at_idx").on(t.updatedAt),
  ]
);

export type ReliefCase = typeof reliefCases.$inferSelect;
export type NewReliefCase = typeof reliefCases.$inferInsert;

// ---------------------------------------------------------------------------
// messages
// ---------------------------------------------------------------------------

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  caseId: uuid("case_id")
    .notNull()
    .references(() => reliefCases.id),
  senderType: senderTypeEnum("sender_type").notNull(),
  /** Nullable — populated when the sender is an authenticated user. */
  senderUserId: text("sender_user_id"),
  /** Plain-text body, max 2 000 characters (enforced in server code). */
  body: text("body").notNull(),
  /**
   * AI analysis metadata JSON for AI messages.
   * Contains communicationSignals + model/prompt version.
   * Never a corrected copy of reporter text.
   */
  aiMetadata: json("ai_metadata"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

// ---------------------------------------------------------------------------
// urgency_assessments
// ---------------------------------------------------------------------------

export const urgencyAssessments = pgTable("urgency_assessments", {
  id: uuid("id").primaryKey().defaultRandom(),
  caseId: uuid("case_id")
    .notNull()
    .references(() => reliefCases.id),
  source: assessmentSourceEnum("source").notNull(),
  urgencyLevel: urgencyLevelEnum("urgency_level").notNull(),
  /** Factor breakdown JSON. */
  factorBreakdown: json("factor_breakdown").notNull(),
  /** Nullable — present for AI assessments. */
  confidence: text("confidence"),
  /** Nullable — present for AI assessments. */
  missingInformation: json("missing_information"),
  rationale: text("rationale").notNull(),
  /** Nullable — present for AI assessments: model/prompt version. */
  modelVersion: text("model_version"),
  /** Nullable — present for HUMAN assessments: the coordinator's user_id. */
  humanActorId: text("human_actor_id"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type UrgencyAssessment = typeof urgencyAssessments.$inferSelect;
export type NewUrgencyAssessment = typeof urgencyAssessments.$inferInsert;

// ---------------------------------------------------------------------------
// tasks
// ---------------------------------------------------------------------------

export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  caseId: uuid("case_id")
    .notNull()
    .references(() => reliefCases.id),
  /** 1–120 chars (enforced in server code). */
  title: text("title").notNull(),
  /** Optional details, max 500 chars (enforced in server code). */
  details: text("details"),
  position: integer("position").notNull(),
  /** Proposed owner as plain text — nullable. */
  proposedOwner: text("proposed_owner"),
  status: taskStatusEnum("status").notNull().default("TODO"),
  /** Must be approved before case can close; limit 6 approved per case. */
  approved: boolean("approved").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;

// ---------------------------------------------------------------------------
// audit_records
// ---------------------------------------------------------------------------

export const auditRecords = pgTable(
  "audit_records",
  {
    auditId: uuid("audit_id").primaryKey().defaultRandom(),
    caseId: uuid("case_id")
      .notNull()
      .references(() => reliefCases.id),
    /** Fixed to CHAT_STARTED in MVP. */
    eventType: auditEventTypeEnum("event_type").notNull(),
    /** Immutable canonical payload JSON. */
    payload: json("payload").notNull(),
    /** Random 32-byte nonce, hex string. */
    nonce: text("nonce").notNull(),
    /** SHA-256 record hash, hex string. */
    recordHash: text("record_hash").notNull(),
    /** Nullable until anchored on Stellar. */
    stellarTxHash: text("stellar_tx_hash"),
    status: auditStatusEnum("status").notNull().default("PENDING"),
    /** Safe error message — nullable. */
    errorMessage: text("error_message"),
    /** First-message receive time. */
    firstMessageAt: timestamp("first_message_at", {
      withTimezone: true,
    }).notNull(),
    /** Nullable — set after Stellar anchor. */
    stellarLedgerSequence: integer("stellar_ledger_sequence"),
    /** Nullable — Stellar ledger close time. */
    ledgerCloseTime: timestamp("ledger_close_time", { withTimezone: true }),
    /** Nullable — when the record was anchored. */
    anchoredAt: timestamp("anchored_at", { withTimezone: true }),
  },
  (t) => [
    // Prevents duplicate CHAT_STARTED anchors for the same case.
    unique("audit_records_case_event_unique").on(t.caseId, t.eventType),
  ]
);

export type AuditRecord = typeof auditRecords.$inferSelect;
export type NewAuditRecord = typeof auditRecords.$inferInsert;
