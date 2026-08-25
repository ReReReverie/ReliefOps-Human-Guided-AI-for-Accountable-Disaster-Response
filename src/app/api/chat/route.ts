/**
 * src/app/api/chat/route.ts — POST Route Handler for reporter chat.
 *
 * Security:
 *   - Validates Origin header against NEXT_PUBLIC_APP_URL
 *   - Reads HttpOnly reporter session cookie (reliefops_session)
 *   - Zod-validates request body (max 2000 chars)
 *   - Treats reporter message body as untrusted data
 *
 * First message flow:
 *   - Creates case, message, audit record in one transaction
 *   - Sets HttpOnly session cookie
 *   - Runs AI analysis after transaction
 *
 * Subsequent message flow:
 *   - Verifies session cookie
 *   - Saves message, calls AI (or returns awaitingHuman)
 *
 * Never returns raw token hash, system prompt, or model errors to the browser.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  handleFirstMessage,
  handleSubsequentMessage,
  SESSION_COOKIE_NAME,
} from "@/features/chat/service";

const RequestBodySchema = z.object({
  body: z.string().min(1).max(2000),
});

// 10-minute cookie for reporter sessions (reasonable for an intake session)
const SESSION_COOKIE_MAX_AGE = 10 * 60 * 60; // 10 hours

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Validate Origin header
  const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000";
  const origin = request.headers.get("origin");
  if (origin && origin !== appUrl) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // 2. Parse and validate request body
  let parsed;
  try {
    const json = await request.json();
    parsed = RequestBodySchema.safeParse(json);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const { body } = parsed.data;
  const serverReceiveTime = new Date();

  // 3. Check for existing session cookie
  const existingToken = request.cookies.get(SESSION_COOKIE_NAME)?.value;

  const isLocal =
    appUrl.startsWith("http://localhost") ||
    appUrl.startsWith("http://127.0.0.1");

  try {
    if (!existingToken) {
      // First message flow
      const result = await handleFirstMessage(body, serverReceiveTime);
      const { rawToken, ...publicResult } = result;

      const response = NextResponse.json(publicResult, { status: 200 });
      response.cookies.set(SESSION_COOKIE_NAME, rawToken!, {
        httpOnly: true,
        sameSite: "lax",
        secure: !isLocal,
        maxAge: SESSION_COOKIE_MAX_AGE,
        path: "/",
      });
      return response;
    } else {
      // Subsequent message flow
      const result = await handleSubsequentMessage(body, existingToken);
      return NextResponse.json(result, { status: 200 });
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";

    if (message === "SESSION_NOT_FOUND" || message === "SESSION_MISMATCH") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Log safe error code only — no message body, no secrets
    console.error("[chat route] Unhandled error:", message.slice(0, 100));
    return NextResponse.json(
      { error: "An error occurred processing your message" },
      { status: 500 }
    );
  }
}
