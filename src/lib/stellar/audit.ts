/**
 * src/lib/stellar/audit.ts — Stellar Testnet anchoring for CHAT_STARTED events.
 *
 * Canonical payload → salted SHA-256 hash → Manage Data on Stellar Testnet.
 * Server-only — never import in browser code.
 *
 * Mainnet guard: throws at module load if STELLAR_NETWORK !== 'testnet'.
 */
import { createHash, randomBytes } from "crypto";
import {
  Keypair,
  TransactionBuilder,
  Networks,
  Operation,
  Horizon,
} from "@stellar/stellar-sdk";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

// ---------------------------------------------------------------------------
// Mainnet guard (plan §10 — additional runtime check in the Stellar module)
// ---------------------------------------------------------------------------

const STELLAR_NETWORK = process.env["STELLAR_NETWORK"] ?? "testnet";
if (STELLAR_NETWORK !== "testnet") {
  throw new Error(
    `[stellar] STELLAR_NETWORK must be 'testnet', got '${STELLAR_NETWORK}'. ` +
      "Mainnet anchoring is not supported."
  );
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Canonical CHAT_STARTED payload — immutable once created. */
export type ChatStartedPayload = {
  schema_version: "1";
  audit_id: string;
  event_type: "CHAT_STARTED";
  opaque_case_id: string;
  opaque_session_id: string;
  first_message_received_at_utc: string;
};

export type AnchorResult =
  | { ok: true; stellarTxHash: string; ledgerSequence: number; ledgerCloseTime: Date }
  | { ok: false; errorMessage: string };

// ---------------------------------------------------------------------------
// Canonical payload construction
// ---------------------------------------------------------------------------

/**
 * Build the canonical CHAT_STARTED payload with deterministic key order.
 * NEVER includes message body, reporter identity, contacts, AI output, or raw IDs.
 *
 * opaque_case_id  = SHA-256(caseId)   — one-way hash
 * opaque_session_id = SHA-256(sessionTokenHash) — one-way hash of the already-hashed token
 */
export function buildChatStartedPayload(
  auditId: string,
  caseId: string,
  sessionTokenHash: string,
  firstMessageReceivedAt: Date
): ChatStartedPayload {
  const opaqueCaseId = createHash("sha256").update(caseId, "utf8").digest("hex");
  const opaqueSessionId = createHash("sha256")
    .update(sessionTokenHash, "utf8")
    .digest("hex");

  // Deterministic key order (plan §10)
  return {
    schema_version: "1",
    audit_id: auditId,
    event_type: "CHAT_STARTED",
    opaque_case_id: opaqueCaseId,
    opaque_session_id: opaqueSessionId,
    first_message_received_at_utc: firstMessageReceivedAt.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Hash computation (plan §10)
// ---------------------------------------------------------------------------

/**
 * Compute the salted SHA-256 hash of the canonical payload.
 *
 * Algorithm:
 *   SHA256("reliefops:chat-start:v1" || nonce_bytes || canonical_json_utf8_bytes)
 *
 * Bytes are concatenated, NOT strings.
 * nonce is 32 raw bytes (decoded from hex), not the hex string.
 */
export function computeRecordHash(
  nonce: string,
  payload: ChatStartedPayload
): string {
  const prefix = Buffer.from("reliefops:chat-start:v1", "utf8");
  const nonceBytes = Buffer.from(nonce, "hex");
  const canonicalJson = JSON.stringify(payload); // already in deterministic key order
  const payloadBytes = Buffer.from(canonicalJson, "utf8");

  const input = Buffer.concat([prefix, nonceBytes, payloadBytes]);
  return createHash("sha256").update(input).digest("hex");
}

/** Generate a cryptographically random 32-byte nonce, returned as hex string. */
export function generateNonce(): string {
  return randomBytes(32).toString("hex");
}

// ---------------------------------------------------------------------------
// Stellar submission
// ---------------------------------------------------------------------------

/**
 * Submit the 32-byte hash to Stellar Testnet via a Manage Data operation.
 *
 * Entry name: 'reliefops.chat-start.v1'
 * Value: raw 32 bytes of the hash (not hex, not base64)
 */
async function submitToStellar(recordHash: string): Promise<AnchorResult> {
  const secretKey = process.env["STELLAR_AUDIT_SECRET_KEY"];
  const horizonUrl =
    process.env["STELLAR_HORIZON_URL"] ?? "https://horizon-testnet.stellar.org";
  const networkPassphrase =
    process.env["STELLAR_NETWORK_PASSPHRASE"] ??
    Networks.TESTNET;

  if (!secretKey) {
    return { ok: false, errorMessage: "STELLAR_AUDIT_SECRET_KEY is not configured" };
  }

  try {
    const keypair = Keypair.fromSecret(secretKey);
    const server = new Horizon.Server(horizonUrl);

    const account = await server.loadAccount(keypair.publicKey());

    // Value: raw 32 bytes of the hash
    const hashBytes = Buffer.from(recordHash, "hex");

    const tx = new TransactionBuilder(account, {
      fee: "100",
      networkPassphrase,
    })
      .addOperation(
        Operation.manageData({
          name: "reliefops.chat-start.v1",
          value: hashBytes,
        })
      )
      .setTimeout(30)
      .build();

    tx.sign(keypair);

    const result = await server.submitTransaction(tx);

    const ledgerSequence = result.ledger;
    // Fetch ledger close time from Horizon.
    // Cast through unknown: the SDK types CollectionPage<LedgerRecord> for
    // LedgerCallBuilder, but .ledger(n).call() returns a single LedgerRecord.
    const ledgerResult = (await server
      .ledgers()
      .ledger(ledgerSequence)
      .call()) as unknown as { closed_at: string };
    const ledgerCloseTime = new Date(ledgerResult.closed_at);

    return {
      ok: true,
      stellarTxHash: result.hash,
      ledgerSequence,
      ledgerCloseTime,
    };
  } catch (err) {
    // Safe error — never expose raw Stellar errors or secrets
    const safeMsg =
      err instanceof Error
        ? `Stellar submission failed: ${err.message.slice(0, 200)}`
        : "Stellar submission failed: unknown error";
    console.error("[stellar] submission error:", safeMsg);
    return { ok: false, errorMessage: safeMsg };
  }
}

// ---------------------------------------------------------------------------
// Anchor CHAT_STARTED (called after first message transaction commits)
// ---------------------------------------------------------------------------

/**
 * Submit an existing PENDING audit record to Stellar Testnet.
 * On success: sets status=ANCHORED with Stellar metadata.
 * On failure: sets status=FAILED with a safe error message.
 *
 * Idempotent: if the record is already ANCHORED, returns immediately.
 */
export async function anchorChatStarted(
  auditId: string,
  caseId: string
): Promise<void> {
  const db = getDb();

  // Load the existing audit record
  const record = await db.query.auditRecords.findFirst({
    where: eq(schema.auditRecords.auditId, auditId),
  });

  if (!record) {
    console.error(`[stellar] anchorChatStarted: no audit record found for auditId=${auditId}`);
    return;
  }

  // Idempotency check — already anchored, stop
  if (record.status === "ANCHORED") {
    return;
  }

  // Submit using the stored (immutable) hash — never recompute
  const result = await submitToStellar(record.recordHash);

  if (result.ok) {
    await db
      .update(schema.auditRecords)
      .set({
        status: "ANCHORED",
        stellarTxHash: result.stellarTxHash,
        stellarLedgerSequence: result.ledgerSequence,
        ledgerCloseTime: result.ledgerCloseTime,
        anchoredAt: new Date(),
        errorMessage: null,
      })
      .where(eq(schema.auditRecords.auditId, auditId));

    console.log(
      `[stellar] anchored auditId=${auditId} caseId=${caseId} tx=${result.stellarTxHash}`
    );
  } else {
    await db
      .update(schema.auditRecords)
      .set({
        status: "FAILED",
        errorMessage: result.errorMessage,
      })
      .where(eq(schema.auditRecords.auditId, auditId));

    console.error(
      `[stellar] anchor FAILED auditId=${auditId} caseId=${caseId}: ${result.errorMessage}`
    );
  }
}
