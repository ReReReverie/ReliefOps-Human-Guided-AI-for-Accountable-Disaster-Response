/**
 * src/lib/stellar/verify.ts — Hash recomputation and Horizon verification.
 *
 * Used by the public /verify/[auditId] page.
 * Server-only — never import in browser code. Never exposes the nonce publicly.
 */
import { Horizon } from "@stellar/stellar-sdk";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { computeRecordHash } from "@/lib/stellar/audit";
import type { ChatStartedPayload } from "@/lib/stellar/audit";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VerificationStatus = "VERIFIED" | "FAILED" | "NOT_ANCHORED" | "NOT_FOUND";

export type VerificationResult = {
  status: VerificationStatus;
  auditId: string;
  /** Stored hex hash from DB */
  storedHash: string | null;
  /** Hash recomputed from payload + nonce */
  recomputedHash: string | null;
  /** Hash decoded from on-chain Manage Data value */
  onChainHash: string | null;
  /** The claimed first-message receive time (from DB) */
  firstMessageAt: Date | null;
  /** Stellar ledger close time from Horizon */
  ledgerCloseTime: Date | null;
  /** Stellar TX hash */
  stellarTxHash: string | null;
};

// ---------------------------------------------------------------------------
// Horizon fetch
// ---------------------------------------------------------------------------

/**
 * Fetch the Manage Data value from the Stellar transaction on Horizon.
 * Returns the hex-encoded 32-byte hash, or null if not found / wrong format.
 */
async function fetchOnChainHash(stellarTxHash: string): Promise<string | null> {
  const horizonUrl =
    process.env["STELLAR_HORIZON_URL"] ?? "https://horizon-testnet.stellar.org";

  try {
    const server = new Horizon.Server(horizonUrl);

    // Fetch operations for this transaction
    const ops = await server
      .operations()
      .forTransaction(stellarTxHash)
      .call();

    for (const op of ops.records) {
      // Find the Manage Data operation
      if (op.type === "manage_data" && op.name === "reliefops.chat-start.v1") {
        // Horizon returns base64-encoded bytes; SDK types it as Buffer but
        // the actual JSON value over the wire is a base64 string.
        const rawValue = op.value as unknown as string;
        if (!rawValue) return null;
        const decoded = Buffer.from(rawValue, "base64");
        if (decoded.length !== 32) return null;
        return decoded.toString("hex");
      }
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Verify
// ---------------------------------------------------------------------------

/**
 * Verify an audit record by:
 *  1. Loading the audit record from DB
 *  2. Recomputing the salted hash from stored payload + nonce
 *  3. Fetching the on-chain Manage Data value from Horizon
 *  4. Comparing all three hashes
 *
 * The nonce is used server-side only — NEVER returned to the caller.
 * The public page receives only the VerificationResult (which omits nonce).
 */
export async function verifyAuditRecord(auditId: string): Promise<VerificationResult> {
  const db = getDb();

  const record = await db.query.auditRecords.findFirst({
    where: eq(schema.auditRecords.auditId, auditId),
  });

  if (!record) {
    return {
      status: "NOT_FOUND",
      auditId,
      storedHash: null,
      recomputedHash: null,
      onChainHash: null,
      firstMessageAt: null,
      ledgerCloseTime: null,
      stellarTxHash: null,
    };
  }

  if (record.status !== "ANCHORED" || !record.stellarTxHash) {
    return {
      status: "NOT_ANCHORED",
      auditId,
      storedHash: record.recordHash,
      recomputedHash: null,
      onChainHash: null,
      firstMessageAt: record.firstMessageAt,
      ledgerCloseTime: record.ledgerCloseTime,
      stellarTxHash: record.stellarTxHash,
    };
  }

  // Recompute hash using stored immutable payload + nonce
  const payload = record.payload as ChatStartedPayload;
  const recomputedHash = computeRecordHash(record.nonce, payload);

  // Fetch on-chain value from Horizon
  const onChainHash = await fetchOnChainHash(record.stellarTxHash);

  // All three must match
  const allMatch =
    recomputedHash === record.recordHash &&
    onChainHash !== null &&
    onChainHash === record.recordHash;

  return {
    status: allMatch ? "VERIFIED" : "FAILED",
    auditId,
    storedHash: record.recordHash,
    recomputedHash,
    onChainHash,
    firstMessageAt: record.firstMessageAt,
    ledgerCloseTime: record.ledgerCloseTime,
    stellarTxHash: record.stellarTxHash,
  };
}
