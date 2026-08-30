/**
 * POST /api/chat — reporter message endpoint.
 *
 * `caseId` is optional for backwards compatibility:
 *   - omitted: preserve the legacy single-case cookie flow;
 *   - null: create a new case in the authorized workspace;
 *   - UUID: continue only the case authorized by the workspace cookie.
 *
 * Workspace and case credentials are HttpOnly cookies. This handler never
 * accepts a token in JSON, never returns token material, and never exposes
 * internal AI metadata.
 */
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  handleFirstMessage,
  handleSubsequentMessage,
  handleWorkspaceMessage,
  SESSION_COOKIE_NAME,
} from "@/features/chat/service";
import {
  ensureReporterWorkspace,
  workspaceCookieMaxAge,
  WORKSPACE_COOKIE_NAME,
} from "@/features/chat/workspace";
import { isAllowedReporterOrigin } from "@/lib/auth/reporter";
import { isUuid } from "@/lib/ids";

const RequestBodySchema = z
  .object({
    body: z.string().min(1).max(2000),
    caseId: z.union([z.string().max(128), z.null()]).optional(),
  })
  .strict();

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

function safeErrorResponse(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "Unknown error";

  if (
    message === "SESSION_NOT_FOUND" ||
    message === "SESSION_MISMATCH" ||
    message === "SESSION_EXPIRED"
  ) {
    return noStoreJson({ error: "Unauthorized" }, 401);
  }

  // Do not distinguish a missing case from a case in another workspace.
  if (message === "WORKSPACE_CASE_NOT_FOUND") {
    return noStoreJson({ error: "Not found" }, 404);
  }

  // Log only a bounded server-side error code. Reporter text and secrets must
  // never be included in logs or browser responses.
  console.error("[chat route] Unhandled error:", message.slice(0, 100));
  return noStoreJson(
    { error: "An error occurred processing your message" },
    500
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";
  if (!isAllowedReporterOrigin(request.headers.get("origin"), appUrl)) {
    return noStoreJson({ error: "Forbidden" }, 403);
  }

  let parsed: z.infer<typeof RequestBodySchema>;
  try {
    const result = RequestBodySchema.safeParse(await request.json());
    if (!result.success) {
      return noStoreJson(
        { error: "Validation failed", details: result.error.flatten() },
        422
      );
    }
    parsed = result.data;
  } catch {
    return noStoreJson({ error: "Invalid request body" }, 400);
  }

  const now = new Date();
  const cookieStore = await cookies();
  const workspaceToken = cookieStore.get(WORKSPACE_COOKIE_NAME)?.value;
  const legacyToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  try {
    // Resolve a workspace for every request. This creates the workspace (but
    // not a case) before a `caseId: null` first message and securely adopts one
    // legacy case only when no workspace cookie was present.
    const resolution = await ensureReporterWorkspace({
      workspaceToken,
      legacySessionToken: legacyToken,
      now,
    });

    const hasCaseIdProperty = Object.prototype.hasOwnProperty.call(
      parsed,
      "caseId"
    );
    let result;

    if (hasCaseIdProperty && parsed.caseId === null) {
      // Explicit new-chat semantics. The case is created atomically with its
      // first message by handleFirstMessage.
      result = await handleFirstMessage(parsed.body, now, {
        workspaceId: resolution.workspace.id,
        sessionExpiresAt: resolution.workspace.expiresAt,
      });
    } else if (hasCaseIdProperty && typeof parsed.caseId === "string") {
      if (!isUuid(parsed.caseId)) {
        return noStoreJson({ error: "Not found" }, 404);
      }
      result = await handleWorkspaceMessage(
        parsed.body,
        parsed.caseId,
        resolution.workspace.id,
        now
      );
    } else if (legacyToken) {
      // Omitted caseId is the original public contract. Keep it tied to the
      // legacy cookie for rollback/migration compatibility.
      result = await handleSubsequentMessage(parsed.body, legacyToken);
    } else {
      // A first message from the new workspace-aware client.
      result = await handleFirstMessage(parsed.body, now, {
        workspaceId: resolution.workspace.id,
        sessionExpiresAt: resolution.workspace.expiresAt,
      });
    }

    const local = isLocalApp(appUrl);

    if ("rawToken" in result && result.rawToken) {
      const { rawToken, ...publicResult } = result;
      const response = noStoreJson(publicResult, 200);
      response.cookies.set(SESSION_COOKIE_NAME, rawToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: !local,
        maxAge: workspaceCookieMaxAge(resolution.workspace.expiresAt, now),
        path: "/",
      });
      if (resolution.rawToken) {
        response.cookies.set(WORKSPACE_COOKIE_NAME, resolution.rawToken, {
          httpOnly: true,
          sameSite: "lax",
          secure: !local,
          maxAge: workspaceCookieMaxAge(
            resolution.workspace.expiresAt,
            now
          ),
          path: "/",
        });
      }
      return response;
    }

    const response = noStoreJson(result, 200);
    if (resolution.rawToken) {
      response.cookies.set(WORKSPACE_COOKIE_NAME, resolution.rawToken, {
        httpOnly: true,
        sameSite: "lax",
        secure: !local,
        maxAge: workspaceCookieMaxAge(resolution.workspace.expiresAt, now),
        path: "/",
      });
    }
    return response;
  } catch (error) {
    return safeErrorResponse(error);
  }
}
