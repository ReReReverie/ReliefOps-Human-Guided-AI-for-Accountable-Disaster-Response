/**
 * POST /api/audit/[auditId]/retry — Idempotent Stellar anchor retry.
 *
 * Auth required: valid coordinator session.
 * Reuses existing payload, nonce, and recordHash — never recomputes them.
 * Once ANCHORED, returns 200 with no further submission.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireCoordinatorSession } from "@/lib/auth/coordinator";
import { anchorChatStarted } from "@/lib/stellar/audit";
import { getDb, schema } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { eq } from "drizzle-orm";

export async function POST(
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

  // Load the record first to check it exists
  const db = getDb();
  const record = await db.query.auditRecords.findFirst({
    where: eq(schema.auditRecords.auditId, auditId),
  });

  if (!record) {
    return NextResponse.json({ error: "Audit record not found" }, { status: 404 });
  }

  // If already anchored, return success without re-submitting (idempotent)
  if (record.status === "ANCHORED") {
    return NextResponse.json({ status: "ANCHORED", alreadyAnchored: true });
  }

  // Retry submission (reuses existing payload/nonce/hash from DB)
  await anchorChatStarted(auditId, record.caseId);

  // Reload to get updated status
  const updated = await db.query.auditRecords.findFirst({
    where: eq(schema.auditRecords.auditId, auditId),
  });

  return NextResponse.json({
    status: updated?.status ?? "FAILED",
    stellarTxHash: updated?.stellarTxHash ?? null,
  });
}
