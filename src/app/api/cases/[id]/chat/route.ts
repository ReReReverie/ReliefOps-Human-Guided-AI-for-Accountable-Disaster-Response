/**
 * GET /api/cases/[id]/chat — reporter-visible transcript for one workspace
 * member. Unlike the legacy `/api/cases/[id]` endpoint, this contract never
 * authorizes from a bare case cookie: workspace membership is required.
 */
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import {
  getActiveReporterWorkspace,
  loadReporterTranscript,
  WORKSPACE_COOKIE_NAME,
} from "@/features/chat/workspace";
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
  // Invalid IDs and unauthorized IDs intentionally share the same response.
  if (!isUuid(caseId)) return noStoreJson({ error: "Not found" }, 404);

  try {
    const cookieStore = await cookies();
    const workspace = await getActiveReporterWorkspace(
      cookieStore.get(WORKSPACE_COOKIE_NAME)?.value
    );
    if (!workspace) return noStoreJson({ error: "Not found" }, 404);

    const transcript = await loadReporterTranscript(workspace, caseId);
    if (!transcript) return noStoreJson({ error: "Not found" }, 404);

    return noStoreJson({
      ...transcript,
      aiProvider: process.env["AI_PROVIDER"] ?? "ollama",
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[reporter transcript route] Unhandled error:", message.slice(0, 100));
    return noStoreJson({ error: "Conversation is temporarily unavailable" }, 503);
  }
}
