/**
 * src/lib/auth/neon.ts — Singleton Neon Auth server instance.
 *
 * Creates a single `createNeonAuth` instance for use in server actions,
 * route handlers, and server components. Reads environment variables at
 * call time rather than at module load so that builds without secrets
 * (e.g. `pnpm build` without `.env.local`) do not fail at import time.
 *
 * When LOCAL_DEV=true this module is not used — auth is handled by
 * src/lib/auth/local.ts instead. getNeonAuth() will throw a clear error
 * if called in LOCAL_DEV mode so the bug is obvious rather than silent.
 *
 * Server-only — never import in browser code.
 */
import { createNeonAuth } from "@neondatabase/auth/next/server";

let _auth: ReturnType<typeof createNeonAuth> | undefined;

/**
 * Returns the singleton Neon Auth instance.
 * Lazy-initialised so `import` does not fail during build without env vars.
 * Throws immediately with a clear message if LOCAL_DEV=true.
 */
export function getNeonAuth(): ReturnType<typeof createNeonAuth> {
  if (process.env["LOCAL_DEV"] === "true") {
    throw new Error(
      "getNeonAuth() must not be called when LOCAL_DEV=true. " +
        "Use src/lib/auth/local.ts instead."
    );
  }
  if (!_auth) {
    const baseUrl = process.env["NEON_AUTH_BASE_URL"];
    const secret = process.env["NEON_AUTH_COOKIE_SECRET"];
    if (!baseUrl || !secret) {
      throw new Error(
        "NEON_AUTH_BASE_URL and NEON_AUTH_COOKIE_SECRET must be set"
      );
    }
    _auth = createNeonAuth({
      baseUrl,
      cookies: { secret },
    });
  }
  return _auth;
}
