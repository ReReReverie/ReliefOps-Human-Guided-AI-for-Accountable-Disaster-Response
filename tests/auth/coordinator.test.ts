/**
 * tests/auth/coordinator.test.ts
 *
 * Negative tests for coordinator authorization.
 * These run entirely in-memory — no live Neon connection required.
 * A custom verifyFn and in-memory ProfileStore mock avoid any network calls.
 */
import { describe, it, expect } from "vitest";
import {
  requireCoordinator,
  type ProfileStore,
  type NeonAuthSession,
} from "@/lib/auth/coordinator";
import type { Profile } from "@/lib/schema";

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

/** Always resolves with the provided session (simulates a valid Neon Auth token). */
function makeVerifier(
  session: NeonAuthSession | null
): (token: string) => Promise<NeonAuthSession | null> {
  return async (_token: string) => session;
}

/** Always rejects (simulates an invalid / expired token). */
const invalidVerifier = makeVerifier(null);

/** In-memory profile store. */
function makeStore(profiles: Profile[]): ProfileStore {
  return {
    async getByUserId(userId: string) {
      return profiles.find((p) => p.userId === userId);
    },
  };
}

const coordinatorProfile: Profile = {
  userId: "user_coordinator_001",
  role: "COORDINATOR",
  displayName: "Demo Coordinator",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("coordinator auth — negative tests", () => {
  it("a request with no token cannot access coordinator routes", async () => {
    const store = makeStore([coordinatorProfile]);
    const result = await requireCoordinator(
      undefined,
      store,
      invalidVerifier
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("no_session");
  });

  it("a request with an empty token cannot access coordinator routes", async () => {
    const store = makeStore([coordinatorProfile]);
    const result = await requireCoordinator("", store, invalidVerifier);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("no_session");
  });

  it("a request with a valid Neon Auth session but no matching profiles row cannot access coordinator routes", async () => {
    const session: NeonAuthSession = {
      userId: "user_no_profile",
      email: "ghost@example.com",
    };
    const verifier = makeVerifier(session);
    // Empty store — no profile for this user
    const store = makeStore([]);

    const result = await requireCoordinator("valid_token", store, verifier);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("no_profile");
  });

  it("a valid Neon Auth session with a profiles row succeeds for coordinators", async () => {
    const session: NeonAuthSession = {
      userId: coordinatorProfile.userId,
      email: "coord@example.com",
    };
    const verifier = makeVerifier(session);
    const store = makeStore([coordinatorProfile]);

    const result = await requireCoordinator("valid_token", store, verifier);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.userId).toBe(coordinatorProfile.userId);
      expect(result.displayName).toBe(coordinatorProfile.displayName);
    }
  });
});
