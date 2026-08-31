/**
 * src/features/chat/service.ts — First-message and subsequent-message chat logic.
 *
 * Responsibilities:
 *   - First message: create case, first message, and pending CHAT_STARTED audit
 *     record in one DB transaction. Set HttpOnly cookie. Then call AI analysis.
 *   - Subsequent messages: validate session cookie, load case, save message, call AI.
 *   - Human mode: save message, return awaitingHuman=true (no Ollama call).
 *   - AI failure: save deterministic failure message, keep case accessible.
 *
 * NEVER holds a DB transaction open during AI inference.
 * Server-only — never import in browser code.
 */
import { randomBytes, randomUUID } from "crypto";
import { nanoid } from "nanoid";
import { and, eq, gt } from "drizzle-orm";

import { getDb, schema } from "@/lib/db";
import {
  hashSessionToken,
  reporterSessionExpiresAt,
  verifySessionToken,
} from "@/lib/auth/reporter";
import {
  computeMessageStyle,
  createAiProvider,
  OllamaFailure,
  PROMPT_VERSION,
  MODEL_VERSION,
} from "@/features/ai";
import type { CaseFactsPatch } from "@/features/ai/provider";
import {
  buildChatStartedPayload,
  computeRecordHash,
  generateNonce,
  anchorChatStarted,
} from "@/lib/stellar/audit";

export const SESSION_COOKIE_NAME = "reliefops_session";

/** Deterministic failure message text (spec §11). */
export const FAILURE_MESSAGE =
  "Your report was saved, but the AI assistant is temporarily unavailable. A human coordinator can still review the information you provided.";

const STABLE_FACT_KEYS = new Set<keyof CaseFactsPatch>([
  "incidentType",
  "locationDescription",
  "victimName",
  "reporterAlias",
  "reporterRelationship",
  "reporterLocationDescription",
  "peopleAffected",
]);

function normalizedFactText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function isReporterLocationMention(
  latestBody: string,
  normalizedCandidate: string
): boolean {
  const normalizedBody = normalizedFactText(latestBody);
  const candidateIndex = normalizedBody.indexOf(normalizedCandidate);
  if (candidateIndex < 0) return false;
  const prefix = normalizedBody.slice(Math.max(0, candidateIndex - 120), candidateIndex);
  return /(?:\b(?:my|our)\s+location\s+(?:is\s+)?|\b(?:i\s+am|i\s+m)\s+(?:(?:currently|located|standing|calling|reporting)\s+)?(?:at|in|near|from)\s+|\b(?:reporting|calling)\s+from\s+)$/i.test(
    prefix
  );
}

function explicitlyMentionsFact(
  key: keyof CaseFactsPatch,
  value: unknown,
  latestBody: string
): boolean {
  const normalizedBody = normalizedFactText(latestBody);
  if (typeof value === "string") {
    const normalizedValue = normalizedFactText(value);
    if (
      normalizedValue &&
      normalizedBody.includes(normalizedValue) &&
      !(
        key === "locationDescription" &&
        isReporterLocationMention(latestBody, normalizedValue)
      )
    ) {
      return true;
    }
  }

  if (key === "reporterRelationship") {
    const relationshipCues: Record<string, RegExp> = {
      SELF: /\b(?:i|we)\s+(?:am|are)\s+(?:the\s+)?(?:victim|affected\s+person|person\s+needing\s+help)\b/i,
      NEARBY_WITNESS: /\b(?:i|we)\s+(?:am|are)\s+(?:a\s+|the\s+|[A-Za-z][A-Za-z'’-]*['’]s\s+)?(?:nearby\s+)?(?:witness|neighbor|neighbour)\b/i,
      FAMILY_OR_CAREGIVER: /\b(?:i|we)\s+(?:am|are)\s+(?:a\s+)?(?:family\s+member|caregiver|parent)\b/i,
      OTHER: /\b(?:someone|somebody)\s+else\b|\bother\b/i,
    };
    return (
      typeof value === "string" &&
      Boolean(relationshipCues[value]?.test(latestBody))
    );
  }

  if (key === "peopleAffected" && typeof value === "number") {
    return new RegExp(`\\b${value}\\b`).test(latestBody);
  }

  return false;
}

/**
 * Apply an AI facts patch without allowing nulls to erase stored facts or
 * unsupported model output to replace stable identity/location fields. Stable
 * changes are accepted only when the newest reporter message explicitly
 * contains the candidate value; safety/status fields remain updateable so a
 * reporter can correct a prior injury or access description.
 */
export function mergeConfirmedFacts(
  currentFacts: CaseFactsPatch,
  factsPatch: CaseFactsPatch,
  latestBody: string
): CaseFactsPatch {
  const merged: Record<string, unknown> = { ...currentFacts };

  for (const [rawKey, value] of Object.entries(factsPatch)) {
    const key = rawKey as keyof CaseFactsPatch;
    if (value === null || value === undefined) continue;

    const currentValue = currentFacts[key];
    if (
      STABLE_FACT_KEYS.has(key) &&
      currentValue !== undefined &&
      currentValue !== null &&
      currentValue === value
    ) {
      continue;
    }

    // Stable identity/count/location fields are only accepted when the
    // newest reporter turn explicitly supports the candidate. This protects
    // both existing facts from replacement and empty facts from hallucinated
    // model additions.
    if (
      STABLE_FACT_KEYS.has(key) &&
      !explicitlyMentionsFact(key, value, latestBody)
    ) {
      continue;
    }

    // A false immediate-danger patch is meaningful only when the reporter
    // explicitly resolves the hazard; otherwise it could erase a confirmed
    // active threat from a model omission or stale summary.
    if (
      key === "immediateDanger" &&
      currentValue === true &&
      value === false &&
      !/(?:everyone|everybody|all\s+(?:occupants|people)|we|they)\s+(?:is|are|was|were)\s+(?:now\s+)?safe\b|\b(?:fire|flames?|smoke|flood(?:water)?|water|danger|hazard)\b[\s\S]{0,50}\b(?:ended|stopped|gone|out|over|no\s+longer\s+(?:active|rising|flowing))\b/i.test(
        latestBody
      )
    ) {
      continue;
    }

    merged[key] = value;
  }

  return merged as CaseFactsPatch;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PublicMessage = {
  id: string;
  senderType: "REPORTER" | "AI" | "COORDINATOR";
  body: string;
  createdAt: Date;
};

export type ChatResult = {
  caseId: string;
  publicRef: string;
  status: string;
  chatMode: string;
  aiProvider: string;
  messages: PublicMessage[];
  /** Raw session token — only returned on first message to set cookie */
  rawToken?: string;
};

export type HumanModeResult = {
  saved: true;
  awaitingHuman: true;
  /** Included for workspace-aware continuation; optional for legacy callers. */
  caseId?: string;
  publicRef?: string;
  status?: string;
  chatMode?: string;
};

export type FirstMessageOptions = {
  /** Workspace membership proven by the route handler. */
  workspaceId?: string;
  /** Must be the workspace's existing absolute deadline when provided. */
  sessionExpiresAt?: Date;
};


// ---------------------------------------------------------------------------
// First message
// ---------------------------------------------------------------------------

/**
 * Handle the very first reporter message.
 * Creates case, message, and audit record in one transaction.
 * Returns ChatResult with rawToken for cookie setting.
 */
export async function handleFirstMessage(
  body: string,
  serverReceiveTime: Date,
  options: FirstMessageOptions = {}
): Promise<ChatResult> {
  const db = getDb();
  const pepper = process.env["REPORTER_SESSION_PEPPER"]!;

  // Generate session token
  const rawToken = randomBytes(32).toString("hex");
  const tokenHash = hashSessionToken(pepper, rawToken);
  const publicRef = nanoid(12);

  // Pre-generate auditId so it can be included in the canonical payload
  const preAuditId = randomUUID();

  // Create audit nonce and payload (plan §10)
  const nonce = generateNonce();

  // Execute the transaction
  let caseId: string;
  let auditId: string;

  await db.transaction(async (tx) => {
    // 1. Create the case
    const [newCase] = await tx
      .insert(schema.reliefCases)
      .values({
        publicRef,
        sessionTokenHash: tokenHash,
        sessionStartedAt: serverReceiveTime,
        reporterWorkspaceId: options.workspaceId ?? null,
        reporterSessionExpiresAt:
          options.sessionExpiresAt ?? reporterSessionExpiresAt(serverReceiveTime),
        status: "INTAKE",
        chatMode: "AI",
        facts: {},
      })
      .returning({ id: schema.reliefCases.id });

    caseId = newCase.id;

    // Build canonical payload with real caseId and pre-generated auditId
    const auditPayload = buildChatStartedPayload(
      preAuditId,
      caseId,
      tokenHash,
      serverReceiveTime
    );
    const recordHash = computeRecordHash(nonce, auditPayload);

    // 2. Create the first reporter message
    await tx.insert(schema.messages).values({
      caseId,
      senderType: "REPORTER",
      body,
    });

    // 3. Create pending CHAT_STARTED audit record (with pre-generated auditId)
    await tx.insert(schema.auditRecords).values({
      auditId: preAuditId,
      caseId,
      eventType: "CHAT_STARTED",
      payload: auditPayload,
      nonce,
      recordHash,
      status: "PENDING",
      firstMessageAt: serverReceiveTime,
    });

    auditId = preAuditId;
  });

  // After transaction commits: real Stellar anchor (async, non-blocking)
  anchorChatStarted(auditId!, caseId!).catch((err) => {
    console.error(`[stellar] anchorChatStarted error for auditId=${auditId!}:`, err);
  });

  // Call AI analysis (outside transaction — never hold transaction during inference)
  const messages = await runAiAnalysis(caseId!, body);

  const caseRow = await db.query.reliefCases.findFirst({
    where: eq(schema.reliefCases.id, caseId!),
  });

  return {
    caseId: caseId!,
    publicRef,
    status: caseRow?.status ?? "INTAKE",
    chatMode: caseRow?.chatMode ?? "AI",
    aiProvider: process.env["AI_PROVIDER"] ?? "ollama",
    messages,
    rawToken,
  };
}

// ---------------------------------------------------------------------------
// Subsequent message
// ---------------------------------------------------------------------------

/**
 * Handle a subsequent reporter message (session already established).
 * Returns either a ChatResult or HumanModeResult.
 */
export async function handleSubsequentMessage(
  body: string,
  rawToken: string
): Promise<ChatResult | HumanModeResult> {
  const db = getDb();
  const pepper = process.env["REPORTER_SESSION_PEPPER"]!;

  // Look up case by token hash
  const tokenHash = hashSessionToken(pepper, rawToken);
  const caseRow = await db.query.reliefCases.findFirst({
    where: eq(schema.reliefCases.sessionTokenHash, tokenHash),
  });

  if (!caseRow) {
    throw new Error("SESSION_NOT_FOUND");
  }

  if (caseRow.reporterSessionExpiresAt.getTime() <= Date.now()) {
    throw new Error("SESSION_EXPIRED");
  }

  // Constant-time compare to prevent timing attacks
  if (!verifySessionToken(pepper, rawToken, caseRow.sessionTokenHash)) {
    throw new Error("SESSION_MISMATCH");
  }

  return processSubsequentMessage(caseRow, body);
}

/**
 * Continue a case selected from reporter history. The route must resolve the
 * workspace cookie first; this function still checks membership in the same
 * query so a guessed UUID or another workspace can never be mutated.
 */
export async function handleWorkspaceMessage(
  body: string,
  caseId: string,
  workspaceId: string,
  now = new Date()
): Promise<ChatResult | HumanModeResult> {
  const db = getDb();
  const caseRow = await db.query.reliefCases.findFirst({
    where: (c, { and, eq, gt }) =>
      and(
        eq(c.id, caseId),
        eq(c.reporterWorkspaceId, workspaceId),
        gt(c.reporterSessionExpiresAt, now)
      ),
  });
  if (!caseRow) throw new Error("WORKSPACE_CASE_NOT_FOUND");
  return processSubsequentMessage(caseRow, body);
}

async function processSubsequentMessage(
  caseRow: typeof schema.reliefCases.$inferSelect,
  body: string
): Promise<ChatResult | HumanModeResult> {
  const db = getDb();
  const messageReceivedAt = new Date();

  // Save reporter message before any AI call (spec §3). The case activity
  // update is in the same transaction, and migration 0002 also installs a
  // trigger for coordinator messages.
  await db.transaction(async (tx) => {
    // Re-check the immutable deadline in the same transaction as the insert.
    // The earlier read in the route prevents normal expired requests, while
    // this conditional update closes the race where a request crosses the
    // deadline between authorization and persistence.
    const [activeCase] = await tx
      .update(schema.reliefCases)
      .set({ updatedAt: messageReceivedAt })
      .where(
        and(
          eq(schema.reliefCases.id, caseRow.id),
          gt(schema.reliefCases.reporterSessionExpiresAt, messageReceivedAt)
        )
      )
      .returning({ id: schema.reliefCases.id });

    if (!activeCase) throw new Error("SESSION_EXPIRED");

    await tx.insert(schema.messages).values({
      caseId: caseRow.id,
      senderType: "REPORTER",
      body,
    });
  });

  // If chat mode is HUMAN: do not call Ollama
  if (caseRow.chatMode === "HUMAN") {
    return {
      saved: true,
      awaitingHuman: true,
      caseId: caseRow.id,
      publicRef: caseRow.publicRef,
      status: caseRow.status,
      chatMode: caseRow.chatMode,
    };
  }

  // AI mode: run analysis
  const messages = await runAiAnalysis(caseRow.id, body);

  const updatedCase = await db.query.reliefCases.findFirst({
    where: eq(schema.reliefCases.id, caseRow.id),
  });

  return {
    caseId: caseRow.id,
    publicRef: caseRow.publicRef,
    status: updatedCase?.status ?? caseRow.status,
    chatMode: updatedCase?.chatMode ?? caseRow.chatMode,
    aiProvider: process.env["AI_PROVIDER"] ?? "ollama",
    messages,
  };
}

// ---------------------------------------------------------------------------
// AI analysis flow
// ---------------------------------------------------------------------------

async function runAiAnalysis(
  caseId: string,
  latestBody: string
): Promise<PublicMessage[]> {
  const db = getDb();

  // Load case for current facts
  const caseRow = await db.query.reliefCases.findFirst({
    where: eq(schema.reliefCases.id, caseId),
  });
  if (!caseRow) throw new Error("Case not found during AI analysis");

  // Load latest 8 public messages (spec §3 AI-active intake step 1)
  const allMessages = await db.query.messages.findMany({
    where: eq(schema.messages.caseId, caseId),
    orderBy: (m, { asc }) => [asc(m.createdAt)],
  });

  // Keep only the latest 8 for AI context
  const latest8 = allMessages.slice(-8);

  // Compute capitalization statistics from latest raw reporter message (spec §3 step 2)
  const latestMessageStyle = computeMessageStyle(latestBody);

  const confirmedFacts = (caseRow.facts as CaseFactsPatch) ?? {};

  const input = {
    confirmedFacts,
    publicMessages: latest8.map((m) => ({
      role: m.senderType as "REPORTER" | "AI" | "COORDINATOR",
      body: m.body,
    })),
    latestMessageStyle,
  };

  // Call AI (outside any DB transaction)
  const provider = createAiProvider();
  let analysis;
  try {
    analysis = await provider.analyzeIntake(input);
  } catch (err) {
    // AI failure: save deterministic failure message, keep case accessible
    if (err instanceof OllamaFailure || err instanceof Error) {
      const safeCode =
        err instanceof OllamaFailure ? err.code : "UNKNOWN_ERROR";
      console.error(
        `[ai] analyzeIntake failed caseId=${caseId} code=${safeCode}`
      );
    }
    await db.insert(schema.messages).values({
      caseId,
      senderType: "AI",
      body: FAILURE_MESSAGE,
    });
    return loadPublicMessages(caseId);
  }

  // Apply factsPatch updates (spec §3 step 5)
  if (Object.keys(analysis.factsPatch).length > 0) {
    const currentFacts = (caseRow.facts as CaseFactsPatch) ?? {};
    const updatedFacts = mergeConfirmedFacts(
      currentFacts,
      analysis.factsPatch,
      latestBody
    );
    await db
      .update(schema.reliefCases)
      .set({ facts: updatedFacts, updatedAt: new Date() })
      .where(eq(schema.reliefCases.id, caseId));
  }

  // Save AI message with aiMetadata (spec §3 step 6)
  const aiMetadata = {
    communicationSignals: analysis.communicationSignals,
    modelVersion: MODEL_VERSION,
    promptVersion: PROMPT_VERSION,
  };
  await db.insert(schema.messages).values({
    caseId,
    senderType: "AI",
    body: analysis.assistantMessage,
    aiMetadata,
  });

  // Save urgency assessment if present (spec §3 step 7)
  if (analysis.urgency) {
    await db.insert(schema.urgencyAssessments).values({
      caseId,
      source: "AI",
      urgencyLevel: analysis.urgency.suggestedLevel,
      factorBreakdown: analysis.urgency.factors,
      confidence: String(analysis.urgency.confidence),
      missingInformation: analysis.urgency.missingInformation,
      rationale: analysis.urgency.rationale,
      modelVersion: `${MODEL_VERSION}/${PROMPT_VERSION}`,
    });
  }

  // Save proposed tasks if ready for review (spec §3 step 8, plan §9)
  if (analysis.readyForHumanReview && analysis.proposedTasks) {
    for (let i = 0; i < analysis.proposedTasks.length; i++) {
      const task = analysis.proposedTasks[i];
      await db.insert(schema.tasks).values({
        caseId,
        title: task.title,
        details: task.details,
        proposedOwner: task.proposedOwner,
        position: i,
        status: "TODO",
        approved: false,
      });
    }
  }

  // Move case to REVIEW if readyForHumanReview (spec §3 step 8)
  if (analysis.readyForHumanReview) {
    await db
      .update(schema.reliefCases)
      .set({ status: "REVIEW", updatedAt: new Date() })
      .where(eq(schema.reliefCases.id, caseId));
  }

  return loadPublicMessages(caseId);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function loadPublicMessages(caseId: string): Promise<PublicMessage[]> {
  const db = getDb();
  const rows = await db.query.messages.findMany({
    where: eq(schema.messages.caseId, caseId),
    orderBy: (m, { asc }) => [asc(m.createdAt)],
  });
  return rows.map((r) => ({
    id: r.id,
    senderType: r.senderType as "REPORTER" | "AI" | "COORDINATOR",
    body: r.body,
    createdAt: r.createdAt,
  }));
}

/**
 * Load case data for the GET /api/cases/[id] endpoint.
 * Validates session token ownership.
 */
export async function loadCaseForReporter(
  caseId: string,
  rawToken: string
): Promise<{
  caseId: string;
  publicRef: string;
  status: string;
  chatMode: string;
  facts: CaseFactsPatch;
  messages: PublicMessage[];
  aiSuggestedUrgency: string | null;
  aiProvider: string;
} | null> {
  const db = getDb();
  const pepper = process.env["REPORTER_SESSION_PEPPER"]!;

  const caseRow = await db.query.reliefCases.findFirst({
    where: eq(schema.reliefCases.id, caseId),
  });
  if (!caseRow) return null;

  if (caseRow.reporterSessionExpiresAt.getTime() <= Date.now()) {
    return null;
  }

  if (!verifySessionToken(pepper, rawToken, caseRow.sessionTokenHash)) {
    return null;
  }

  const messages = await loadPublicMessages(caseId);

  // Latest AI urgency assessment
  const assessments = await db.query.urgencyAssessments.findMany({
    where: eq(schema.urgencyAssessments.caseId, caseId),
    orderBy: (a, { desc }) => [desc(a.createdAt)],
  });
  const latestAi = assessments.find((a) => a.source === "AI");

  return {
    caseId: caseRow.id,
    publicRef: caseRow.publicRef,
    status: caseRow.status,
    chatMode: caseRow.chatMode,
    facts: (caseRow.facts as CaseFactsPatch) ?? {},
    messages,
    aiSuggestedUrgency: latestAi?.urgencyLevel ?? null,
    aiProvider: process.env["AI_PROVIDER"] ?? "ollama",
  };
}
