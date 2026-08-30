/** GET /api/chat/history — metadata-only history for the active workspace. */
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import {
  getActiveReporterWorkspace,
  HISTORY_DEFAULT_LIMIT,
  HISTORY_MAX_LIMIT,
  listReporterHistory,
  WORKSPACE_COOKIE_NAME,
} from "@/features/chat/workspace";
import { isAllowedReporterOrigin } from "@/lib/auth/reporter";

function noStoreJson(body: unknown, status = 200): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Cookie");
  return response;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";
  if (!isAllowedReporterOrigin(request.headers.get("origin"), appUrl)) {
    return noStoreJson({ error: "Forbidden" }, 403);
  }

  const limitParam = request.nextUrl.searchParams.get("limit");
  const cursor = request.nextUrl.searchParams.get("cursor");
  let limit = HISTORY_DEFAULT_LIMIT;
  if (limitParam !== null) {
    if (!/^[0-9]{1,3}$/.test(limitParam)) {
      return noStoreJson({ error: "Invalid history limit" }, 400);
    }
    limit = Number(limitParam);
  }
  if (limit < 1 || limit > HISTORY_MAX_LIMIT) {
    return noStoreJson({ error: "Invalid history limit" }, 400);
  }
  if (cursor !== null && cursor.length > 512) {
    return noStoreJson({ error: "Invalid history cursor" }, 400);
  }

  try {
    const cookieStore = await cookies();
    const workspace = await getActiveReporterWorkspace(
      cookieStore.get(WORKSPACE_COOKIE_NAME)?.value
    );
    if (!workspace) {
      return noStoreJson({ error: "Workspace expired or unavailable" }, 401);
    }

    const result = await listReporterHistory(workspace, {
      cursor,
      limit,
    });
    return noStoreJson({
      items: result.items,
      nextCursor: result.nextCursor,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    if (message === "INVALID_HISTORY_CURSOR") {
      return noStoreJson({ error: "Invalid history cursor" }, 400);
    }
    if (message === "WORKSPACE_EXPIRED") {
      return noStoreJson({ error: "Workspace expired or unavailable" }, 401);
    }
    console.error("[history route] Unhandled error:", message.slice(0, 100));
    return noStoreJson({ error: "History is temporarily unavailable" }, 503);
  }
}
