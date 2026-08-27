/**
 * src/app/api/auth/[...path]/route.ts — Neon Auth API handler.
 *
 * Proxies all Neon Auth requests (sign-in, sign-up, session, sign-out).
 * When LOCAL_DEV=true this route returns 404 because local auth is handled
 * entirely by the login server action and the local session cookie.
 */
import { NextResponse } from "next/server";

function localDevResponse() {
  return NextResponse.json(
    { error: "Neon Auth is disabled in LOCAL_DEV mode." },
    { status: 404 }
  );
}

export function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  if (process.env["LOCAL_DEV"] === "true") return localDevResponse();
  // Dynamic import so build without NEON_AUTH_BASE_URL does not fail
  return import("@/lib/auth/neon").then(({ getNeonAuth }) =>
    getNeonAuth().handler().GET(request, { params })
  );
}

export function POST(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  if (process.env["LOCAL_DEV"] === "true") return localDevResponse();
  return import("@/lib/auth/neon").then(({ getNeonAuth }) =>
    getNeonAuth().handler().POST(request, { params })
  );
}
