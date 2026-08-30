/**
 * src/lib/auth/reporter.ts — Reporter session helpers.
 *
 * Rules (from plan §6):
 *   - Generate a 32-byte cryptographically random session token.
 *   - Store ONLY HMAC-SHA-256(REPORTER_SESSION_PEPPER, token) in Neon.
 *   - Restore a session by re-hashing the cookie token and comparing with
 *     constant-time equality against the stored hash.
 *
 * These are pure helper functions; no middleware or route wrapping.
 * Server-only — never import in browser code.
 */

import { createHmac, randomBytes, timingSafeEqual } from "crypto";

/**
 * The legacy per-case cookie remains supported while clients migrate to a
 * workspace. New reporter history uses a separate token and cookie so a
 * browser can select several explicitly-authorized cases without relying on
 * whichever case cookie happened to be written last.
 */
export const WORKSPACE_COOKIE_NAME = "reliefops_workspace";
export const REPORTER_SESSION_MAX_AGE_SECONDS = 10 * 60 * 60;
export const REPORTER_SESSION_MAX_AGE_MS =
  REPORTER_SESSION_MAX_AGE_SECONDS * 1000;

const WORKSPACE_TOKEN_DOMAIN = "reliefops/reporter-workspace/v1:";

/**
 * Generate a new 32-byte cryptographically random session token.
 * Returns the token as a hex string (64 chars).
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
}

/** Generate the raw 32-byte token used by the workspace HttpOnly cookie. */
export function generateWorkspaceToken(): string {
  return generateSessionToken();
}

/**
 * Hash a raw reporter session token with HMAC-SHA-256 using the pepper.
 * Returns a hex string — this is what gets stored in `relief_cases.session_token_hash`.
 *
 * @param pepper  REPORTER_SESSION_PEPPER environment value
 * @param token   Raw token (from the cookie)
 */
export function hashSessionToken(pepper: string, token: string): string {
  return createHmac("sha256", pepper).update(token).digest("hex");
}

/**
 * Hash a workspace token with domain separation from legacy case tokens.
 * Only this digest is persisted in `reporter_workspaces.token_hash`.
 */
export function hashWorkspaceToken(pepper: string, token: string): string {
  return hashSessionToken(pepper, `${WORKSPACE_TOKEN_DOMAIN}${token}`);
}

/** Constant-time verification for a workspace cookie token. */
export function verifyWorkspaceToken(
  pepper: string,
  rawToken: string,
  storedHash: string
): boolean {
  return constantTimeEqual(hashWorkspaceToken(pepper, rawToken), storedHash);
}

/**
 * Verify a raw reporter cookie token against a stored hash using constant-time
 * comparison to prevent timing attacks.
 *
 * @param pepper      REPORTER_SESSION_PEPPER environment value
 * @param rawToken    Token extracted from the reporter's cookie
 * @param storedHash  Hash stored in `relief_cases.session_token_hash`
 * @returns true if the token matches the stored hash
 */
export function verifySessionToken(
  pepper: string,
  rawToken: string,
  storedHash: string
): boolean {
  const computed = hashSessionToken(pepper, rawToken);
  // Both must be the same length for timingSafeEqual to work correctly.
  // Our HMAC-SHA-256 hex output is always 64 chars, so this is always true
  // for well-formed inputs; handle malformed stored hashes defensively.
  return constantTimeEqual(computed, storedHash);
}

/**
 * Constant-time string comparison (hex strings only).
 * Exported for use in tests and any additional callers that need it.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  // Reject malformed hex before converting. Buffer.from(..., "hex") silently
  // truncates malformed input, which could otherwise make timingSafeEqual
  // throw or compare fewer bytes than intended.
  if (
    a.length !== b.length ||
    a.length % 2 !== 0 ||
    !/^[0-9a-f]+$/i.test(a) ||
    !/^[0-9a-f]+$/i.test(b)
  ) {
    return false;
  }
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}

/** Absolute reporter deadline for a newly-created session. */
export function reporterSessionExpiresAt(startedAt: Date): Date {
  return new Date(startedAt.getTime() + REPORTER_SESSION_MAX_AGE_MS);
}

/**
 * Normalize an application URL for Origin checks. A missing Origin is allowed
 * for non-browser clients, but a supplied value must match exactly by origin.
 */
export function isAllowedReporterOrigin(
  origin: string | null,
  appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "http://localhost:3000"
): boolean {
  if (!origin) return true;
  try {
    return new URL(origin).origin === new URL(appUrl).origin;
  } catch {
    return false;
  }
}
