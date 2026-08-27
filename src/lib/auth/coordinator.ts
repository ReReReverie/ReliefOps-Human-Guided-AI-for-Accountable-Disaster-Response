/**
 * src/lib/auth/coordinator.ts — Coordinator auth helpers.
 *
 * Rules (from plan §6):
 *   - Validate the Neon Auth session.
 *   - Require a matching `profiles` row with role = 'COORDINATOR'.
 *
 * `requireCoordinator` is the primary guard used in server actions and pages.
 * It accepts an injectable verifyFn so that tests can run without a live connection.
 *
 * `requireCoordinatorFromRequest` is the production helper that calls Neon Auth
 * directly via `getNeonAuth().getSession()` (reads from Next.js request context).
 *
 * Server-only — never import in browser code.
 */

import { getDb, schema } from "@/lib/db";
import { isLocalAuthBypassEnabled } from "@/lib/auth/local-config";
import { eq } from "drizzle-orm";
import type { Profile } from "@/lib/schema";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NeonAuthSession {
  /** Neon Auth user_id. */
  userId: string;
  email: string;
}

/**
 * Async function that verifies a raw Neon Auth session token/cookie string and
 * returns a decoded session or null if the token is absent or invalid.
 *
 * Tests supply an in-memory mock. Production uses `getProductionVerifier()`.
 */
export type SessionVerifier = (
  rawToken: string
) => Promise<NeonAuthSession | null>;

/**
 * Minimal interface for the profile store used during authorisation checks.
 * Keeps database access injectable so tests can use in-memory fakes.
 */
export interface ProfileStore {
  getByUserId(userId: string): Promise<Profile | undefined>;
}

export type CoordinatorAuthResult =
  | { ok: true; userId: string; displayName: string }
  | { ok: false; reason: "no_session" | "no_profile" | "wrong_role" };

// ---------------------------------------------------------------------------
// Authorization check (injectable — used in tests and production)
// ---------------------------------------------------------------------------

/**
 * Validate a Neon Auth session AND confirm the user has a coordinator profile.
 *
 * @param rawToken    Raw session token string (e.g. from a cookie value).
 *                    Pass `undefined` or `null` to model a missing cookie.
 * @param store       Profile store (real DB or in-memory test mock).
 * @param verifyFn    Async function that validates the token and returns a
 *                    session payload or null.
 */
export async function requireCoordinator(
  rawToken: string | undefined | null,
  store: ProfileStore,
  verifyFn: SessionVerifier
): Promise<CoordinatorAuthResult> {
  if (!rawToken) {
    return { ok: false, reason: "no_session" };
  }

  const session = await verifyFn(rawToken);
  if (!session) {
    return { ok: false, reason: "no_session" };
  }

  const profile = await store.getByUserId(session.userId);
  if (!profile) {
    return { ok: false, reason: "no_profile" };
  }

  if (profile.role !== "COORDINATOR") {
    return { ok: false, reason: "wrong_role" };
  }

  return { ok: true, userId: session.userId, displayName: profile.displayName };
}

// ---------------------------------------------------------------------------
// Production DB profile store
// ---------------------------------------------------------------------------

/**
 * Real ProfileStore backed by Drizzle + Neon.
 */
function getDbProfileStore(): ProfileStore {
  return {
    async getByUserId(userId: string) {
      const db = getDb();
      const row = await db.query.profiles.findFirst({
        where: eq(schema.profiles.userId, userId),
      });
      return row;
    },
  };
}

// ---------------------------------------------------------------------------
// Production guard (uses Neon Auth getSession + DB lookup)
// ---------------------------------------------------------------------------

/**
 * Production coordinator guard.
 * When LOCAL_DEV=true, uses the local coordinator identity. A local HMAC
 * session is required unless LOCAL_AUTH_BYPASS=true is also explicitly set.
 * Otherwise calls `getNeonAuth().getSession()` which reads from the Next.js
 * request context (headers/cookies set by the authApiHandler).
 *
 * Use this in server actions and server components.
 * Returns CoordinatorAuthResult.
 */
export async function requireCoordinatorSession(): Promise<CoordinatorAuthResult> {
  if (process.env["LOCAL_DEV"] === "true") {
    const { getLocalSession, LOCAL_COORD_USER_ID } = await import(
      "@/lib/auth/local"
    );
    const session = isLocalAuthBypassEnabled()
      ? { userId: LOCAL_COORD_USER_ID }
      : await getLocalSession();
    if (!session) return { ok: false, reason: "no_session" };

    const store = getDbProfileStore();
    const profile = await store.getByUserId(session.userId);
    if (!profile) return { ok: false, reason: "no_profile" };
    if (profile.role !== "COORDINATOR") return { ok: false, reason: "wrong_role" };

    return { ok: true, userId: session.userId, displayName: profile.displayName };
  }

  // Lazy import to avoid importing getNeonAuth at build time when env vars may be absent
  const { getNeonAuth } = await import("@/lib/auth/neon");
  const auth = getNeonAuth();

  const { data } = await auth.getSession();
  if (!data?.user) {
    return { ok: false, reason: "no_session" };
  }

  const store = getDbProfileStore();
  const profile = await store.getByUserId(data.user.id);
  if (!profile) {
    return { ok: false, reason: "no_profile" };
  }

  if (profile.role !== "COORDINATOR") {
    return { ok: false, reason: "wrong_role" };
  }

  return {
    ok: true,
    userId: data.user.id,
    displayName: profile.displayName,
  };
}
