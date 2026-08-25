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
import { eq } from "drizzle-orm";

import { getDb, schema } from "@/lib/db";
import { hashSessionToken, verifySessionToken } from "@/lib/auth/reporter";
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
  serverReceiveTime: Date
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

  // Constant-time compare to prevent timing attacks
  if (!verifySessionToken(pepper, rawToken, caseRow.sessionTokenHash)) {
    throw new Error("SESSION_MISMATCH");
  }

  // Save reporter message before any AI call (spec §3)
  await db.insert(schema.messages).values({
    caseId: caseRow.id,
    senderType: "REPORTER",
    body,
  });

  // If chat mode is HUMAN: do not call Ollama
  if (caseRow.chatMode === "HUMAN") {
    return { saved: true, awaitingHuman: true };
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
    const updatedFacts = { ...currentFacts, ...analysis.factsPatch };
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
