/** POST /api/chat/workspace — initialize the browser-bound reporter workspace. */
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";

import {
  ensureReporterWorkspace,
  WORKSPACE_COOKIE_NAME,
  workspaceCookieMaxAge,
} from "@/features/chat/workspace";
import { SESSION_COOKIE_NAME } from "@/features/chat/service";
import {
  isAllowedReporterOrigin,
} from "@/lib/auth/reporter";

function noStoreJson(body: unknown, status = 200): NextResponse {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Vary", "Cookie");
  return response;
}

function isLocalApp(appUrl: string): boolean {
  try {
    const url = new URL(appUrl);
    return (
      url.protocol === "http:" &&
      (url.hostname === "localhost" || url.hostname === "127.0.0.1")
    );
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";
  if (!isAllowedReporterOrigin(request.headers.get("origin"), appUrl)) {
    return noStoreJson({ error: "Forbidden" }, 403);
  }

  try {
    const cookieStore = await cookies();
    const now = new Date();
    const resolution = await ensureReporterWorkspace({
      workspaceToken: cookieStore.get(WORKSPACE_COOKIE_NAME)?.value,
      legacySessionToken: cookieStore.get(SESSION_COOKIE_NAME)?.value,
      now,
    });

    const response = noStoreJson(
      {
        expiresAt: resolution.workspace.expiresAt.toISOString(),
        currentCaseId: resolution.adoptedCaseId ?? null,
      },
      200
    );

    if (resolution.rawToken) {
      response.cookies.set(WORKSPACE_COOKIE_NAME, resolution.rawToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: !isLocalApp(appUrl),
        maxAge: workspaceCookieMaxAge(resolution.workspace.expiresAt, now),
        path: "/",
      });
    }
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("[workspace route] Unhandled error:", message.slice(0, 100));
    return noStoreJson(
      { error: "History is unavailable in this browser session" },
      503
    );
  }
}
