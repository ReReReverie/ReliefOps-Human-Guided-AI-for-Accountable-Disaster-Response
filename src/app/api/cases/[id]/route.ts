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
import { isAllowedReporterOrigin } from "@/lib/auth/reporter";
import { isUuid } from "@/lib/ids";

function noStoreJson(body: unknown, status = 200): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Cookie");
  return response;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";
  if (!isAllowedReporterOrigin(request.headers.get("origin"), appUrl)) {
    return noStoreJson({ error: "Forbidden" }, 403);
  }

  const { id: caseId } = await params;

  // Read reporter session cookie
  const rawToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!rawToken) {
    return noStoreJson({ error: "Unauthorized" }, 401);
  }

  if (!isUuid(caseId)) {
    return noStoreJson({ error: "Not found" }, 404);
  }

  const result = await loadCaseForReporter(caseId, rawToken);
  if (!result) {
    return noStoreJson({ error: "Not found" }, 404);
  }

  return noStoreJson(result, 200);
}
