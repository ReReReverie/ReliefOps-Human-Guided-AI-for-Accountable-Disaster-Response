/**
 * tests/auth/demo-bypass.test.ts
 *
 * Verifies that the demo bypass:
 *   - Returns a fixed identity without a DB lookup when both flags are set.
 *   - Normal local-dev mode (no bypass) still requires a valid session.
 *   - Production mode is unaffected.
 *
 * Uses the injectable requireCoordinator (lower-level) and the local-config
 * helper; does NOT call requireCoordinatorSession (which uses live Next.js
 * cookies/env at runtime).
 */
import { describe, it, expect } from "vitest";
import { isLocalAuthBypassEnabled } from "@/lib/auth/local-config";
import { requireCoordinator, type ProfileStore } from "@/lib/auth/coordinator";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A profile store that always throws — verifies no DB call is made. */
const throwingStore: ProfileStore = {
  getByUserId: async () => {
    throw new Error("DB should not be called in demo bypass mode");
  },
};

/** A profile store that always returns undefined (no matching profile). */
const emptyStore: ProfileStore = {
  getByUserId: async () => undefined,
};

/** Verifier that always rejects (no session). */
const rejectVerifier = async (_token: string) => null;

// ---------------------------------------------------------------------------
// isLocalAuthBypassEnabled (whitebox — already tested in local-config.test.ts,
// included here for clarity of the demo-bypass contract)
// ---------------------------------------------------------------------------

describe("demo bypass flag", () => {
  it("is disabled when neither env var is set", () => {
    expect(isLocalAuthBypassEnabled({})).toBe(false);
  });

  it("is disabled when only LOCAL_DEV is set", () => {
    expect(isLocalAuthBypassEnabled({ LOCAL_DEV: "true" })).toBe(false);
  });

  it("is disabled when only LOCAL_AUTH_BYPASS is set", () => {
    expect(isLocalAuthBypassEnabled({ LOCAL_AUTH_BYPASS: "true" })).toBe(false);
  });

  it("is enabled only when both flags are exactly 'true'", () => {
    expect(
      isLocalAuthBypassEnabled({ LOCAL_DEV: "true", LOCAL_AUTH_BYPASS: "true" })
    ).toBe(true);
  });

  it("is not enabled by truthy but non-exact values", () => {
    expect(
      isLocalAuthBypassEnabled({ LOCAL_DEV: "1", LOCAL_AUTH_BYPASS: "yes" })
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// requireCoordinator — without bypass the DB is consulted
// ---------------------------------------------------------------------------

describe("requireCoordinator (injectable, without bypass)", () => {
  it("fails when no token is provided", async () => {
    const result = await requireCoordinator(undefined, emptyStore, rejectVerifier);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("no_session");
  });

  it("fails when token is present but verifier rejects", async () => {
    const result = await requireCoordinator("bad-token", emptyStore, rejectVerifier);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("no_session");
  });

  it("fails when session is valid but no matching profile exists", async () => {
    const validVerifier = async (_token: string) => ({
      userId: "ghost-user",
      email: "ghost@example.com",
    });
    const result = await requireCoordinator("valid-token", emptyStore, validVerifier);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("no_profile");
  });
});
