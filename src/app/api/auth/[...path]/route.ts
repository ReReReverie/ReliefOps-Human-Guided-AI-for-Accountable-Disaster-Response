/**
 * src/app/api/auth/[...path]/route.ts — Neon Auth API handler.
 *
 * Proxies all Neon Auth requests. Required for sign-in, sign-up,
 * session management, and sign-out to work.
 */
import { getNeonAuth } from "@/lib/auth/neon";

export function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return getNeonAuth().handler().GET(request, { params });
}

export function POST(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  return getNeonAuth().handler().POST(request, { params });
}
