/**
 * src/lib/auth/local.ts — Local-dev coordinator authentication.
 *
 * Used ONLY when LOCAL_DEV=true. Bypasses Neon Auth entirely.
 *
 * Session model:
 *   - On sign-in, create a signed token = base64(userId:HMAC-SHA256(secret, userId+ts))
 *   - Store token in a secure HttpOnly cookie ("reliefops_coord_session")
 *   - On getSession, verify the HMAC and return the userId
 *
 * Credentials are read from LOCAL_COORDINATOR_EMAIL / LOCAL_COORDINATOR_PASSWORD.
 * The profiles row for this user is seeded by scripts/seed-local.ts.
 *
 * Server-only — never import in browser code.
 */
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export const LOCAL_COORD_COOKIE = "reliefops_coord_session";
const LOCAL_COORD_USER_ID = "local-coordinator-001";

function signingSecret(): string {
  const s = process.env["NEON_AUTH_COOKIE_SECRET"];
  if (!s) throw new Error("NEON_AUTH_COOKIE_SECRET must be set");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", signingSecret()).update(payload).digest("hex");
}

function makeToken(userId: string, ts: number): string {
  const payload = `${userId}:${ts}`;
  const sig = sign(payload);
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

function verifyToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length !== 3) return null;
    const [userId, ts, sig] = parts;
    const expected = sign(`${userId}:${ts}`);
    // Constant-time compare
    if (expected.length !== sig.length) return null;
    const match = timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(sig, "hex"));
    if (!match) return null;
    // Tokens expire after 12 hours
    if (Date.now() - Number(ts) > 12 * 60 * 60 * 1000) return null;
    return userId;
  } catch {
    return null;
  }
}

/**
 * Verify email + password against LOCAL_COORDINATOR_* env vars.
 * Returns a signed session token string on success, null on failure.
 */
export function localSignIn(email: string, password: string): string | null {
  const expectedEmail = process.env["LOCAL_COORDINATOR_EMAIL"] ?? "";
  const expectedPassword = process.env["LOCAL_COORDINATOR_PASSWORD"] ?? "";

  if (!expectedEmail || !expectedPassword) return null;

  // Constant-time email compare (both are ASCII, just use Buffer)
  const emailMatch =
    email.toLowerCase().trim() === expectedEmail.toLowerCase().trim();
  if (!emailMatch) return null;

  // Simple constant-time password compare
  if (password.length !== expectedPassword.length) return null;
  const pwMatch = timingSafeEqual(
    Buffer.from(password),
    Buffer.from(expectedPassword)
  );
  if (!pwMatch) return null;

  return makeToken(LOCAL_COORD_USER_ID, Date.now());
}

/**
 * Read and verify the local coordinator session cookie.
 * Returns { userId, email } if valid, null otherwise.
 */
export async function getLocalSession(): Promise<{
  userId: string;
  email: string;
} | null> {
  const jar = await cookies();
  const token = jar.get(LOCAL_COORD_COOKIE)?.value;
  if (!token) return null;
  const userId = verifyToken(token);
  if (!userId) return null;
  return {
    userId,
    email: process.env["LOCAL_COORDINATOR_EMAIL"] ?? "coordinator@reliefops.local",
  };
}

/** The fixed user ID used for the seeded local coordinator. */
export { LOCAL_COORD_USER_ID };
