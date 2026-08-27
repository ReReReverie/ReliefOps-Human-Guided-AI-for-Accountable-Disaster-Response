/**
 * GET /api/audit/case/[caseId] — Fetch the CHAT_STARTED audit record meta
 * for a given case. Used by the SiteHeader to populate the Chat Audit button.
 *
 * Auth required: valid coordinator session.
 * Returns: { auditId, auditStatus } — no nonce, payload, or reporter data.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireCoordinatorSession } from "@/lib/auth/coordinator";
import { getDb, schema } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { eq } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ caseId: string }> }
): Promise<NextResponse> {
  const authResult = await requireCoordinatorSession();
  if (!authResult.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { caseId } = await params;
  if (!isUuid(caseId)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const db = getDb();
  const record = await db.query.auditRecords.findFirst({
    where: eq(schema.auditRecords.caseId, caseId),
  });

  if (!record) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    auditId: record.auditId,
    auditStatus: record.status,
  });
}
