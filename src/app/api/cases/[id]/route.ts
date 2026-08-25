/**
 * src/app/api/cases/[id]/route.ts — GET Route Handler for case data.
 *
 * Security:
 *   - Reads reporter session cookie (HttpOnly reliefops_session)
 *   - Validates case ownership via constant-time hash comparison
 *   - Never returns session token hash or raw token
 *
 * Returns: { caseId, publicRef, status, chatMode, facts, messages, aiSuggestedUrgency, aiProvider }
 */
import { NextRequest, NextResponse } from "next/server";
import { loadCaseForReporter, SESSION_COOKIE_NAME } from "@/features/chat/service";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id: caseId } = await params;

  // Read reporter session cookie
  const rawToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await loadCaseForReporter(caseId, rawToken);
  if (!result) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(result, { status: 200 });
}
