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
 * Generate a new 32-byte cryptographically random session token.
 * Returns the token as a hex string (64 chars).
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString("hex");
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
  if (computed.length !== storedHash.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(computed, "hex"), Buffer.from(storedHash, "hex"));
}

/**
 * Constant-time string comparison (hex strings only).
 * Exported for use in tests and any additional callers that need it.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
}
