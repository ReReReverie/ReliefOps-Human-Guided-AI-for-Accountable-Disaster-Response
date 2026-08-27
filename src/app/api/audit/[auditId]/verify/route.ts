/**
 * GET /api/audit/[auditId]/verify — Chat audit verification for coordinator dashboard.
 *
 * Auth required: valid coordinator session (demo-bypass mode uses fixed identity).
 * Reuses the existing verifyAuditRecord logic from /lib/stellar/verify.
 *
 * Returns a ChatAuditVerificationDto — safe subset of VerificationResult.
 * NEVER exposes: nonce, canonical payload, reporter identity, session data,
 * recomputedHash, or onChainHash (internal verification details).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireCoordinatorSession } from "@/lib/auth/coordinator";
import { verifyAuditRecord } from "@/lib/stellar/verify";
import { isUuid } from "@/lib/ids";

// ---------------------------------------------------------------------------
// DTO
// ---------------------------------------------------------------------------

export type ChatAuditVerificationDto = {
  auditId: string;
  /** DB anchor status: PENDING | ANCHORED | FAILED */
  dbStatus: string;
  /** Verification outcome: VERIFIED | FAILED | NOT_ANCHORED | NOT_FOUND */
  verificationStatus: string;
  /** Server receive time of the first reporter message (ISO string) */
  chatStartedAt: string | null;
  /** When the record was anchored on Stellar (ISO string) */
  anchoredAt: string | null;
  /** Stellar ledger close time (ISO string) */
  ledgerCloseTime: string | null;
  /** Safe stored hash (hex, for display only — nonce never exposed) */
  storedHash: string | null;
  /** Stellar transaction ID */
  stellarTxHash: string | null;
  /** Stellar explorer link (testnet) */
  stellarExplorerUrl: string | null;
};

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ auditId: string }> }
): Promise<NextResponse> {
  const authResult = await requireCoordinatorSession();
  if (!authResult.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { auditId } = await params;
  if (!isUuid(auditId)) {
    return NextResponse.json({ error: "Audit record not found" }, { status: 404 });
  }

  // Load the full DB record to get dbStatus + anchoredAt (not in VerificationResult)
  const { getDb, schema } = await import("@/lib/db");
  const { eq } = await import("drizzle-orm");
  const db = getDb();
  const record = await db.query.auditRecords.findFirst({
    where: eq(schema.auditRecords.auditId, auditId),
  });

  if (!record) {
    return NextResponse.json({ error: "Audit record not found" }, { status: 404 });
  }

  // Run Horizon verification (lazy — only when dialog opens)
  const verification = await verifyAuditRecord(auditId);

  const dto: ChatAuditVerificationDto = {
    auditId,
    dbStatus: record.status,
    verificationStatus: verification.status,
    chatStartedAt: record.firstMessageAt?.toISOString() ?? null,
    anchoredAt: record.anchoredAt?.toISOString() ?? null,
    ledgerCloseTime: verification.ledgerCloseTime?.toISOString() ?? null,
    storedHash: verification.storedHash,
    stellarTxHash: verification.stellarTxHash,
    stellarExplorerUrl: verification.stellarTxHash
      ? `https://stellar.expert/explorer/testnet/tx/${verification.stellarTxHash}`
      : null,
  };

  return NextResponse.json(dto);
}
