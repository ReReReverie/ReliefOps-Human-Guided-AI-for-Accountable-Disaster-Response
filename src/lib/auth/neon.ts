/**
 * src/lib/auth/neon.ts — Singleton Neon Auth server instance.
 *
 * Creates a single `createNeonAuth` instance for use in server actions,
 * route handlers, and server components. Reads environment variables at
 * call time rather than at module load so that builds without secrets
 * (e.g. `pnpm build` without `.env.local`) do not fail at import time.
 *
 * Server-only — never import in browser code.
 */
import { createNeonAuth } from "@neondatabase/auth/next/server";

let _auth: ReturnType<typeof createNeonAuth> | undefined;

/**
 * Returns the singleton Neon Auth instance.
 * Lazy-initialised so `import` does not fail during build without env vars.
 */
export function getNeonAuth(): ReturnType<typeof createNeonAuth> {
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
