/**
 * tests/auth/reporter.test.ts
 *
 * Negative tests for reporter session cookie isolation.
 * These run entirely in-memory — no live Neon connection required.
 */
import { describe, it, expect } from "vitest";
import {
  generateSessionToken,
  generateWorkspaceToken,
  hashSessionToken,
  hashWorkspaceToken,
  isAllowedReporterOrigin,
  reporterSessionExpiresAt,
  verifySessionToken,
  verifyWorkspaceToken,
  constantTimeEqual,
} from "@/lib/auth/reporter";

const PEPPER = "this-is-a-test-pepper-that-is-long-enough-32chars";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function makeCase(token: string) {
  return { sessionTokenHash: hashSessionToken(PEPPER, token) };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("reporter session — negative isolation tests", () => {
  it("a missing (empty) cookie cannot read another reporter's case", () => {
    const realToken = generateSessionToken();
    const storedCase = makeCase(realToken);

    // Simulate no cookie → empty string passed in
    expect(verifySessionToken(PEPPER, "", storedCase.sessionTokenHash)).toBe(
      false
    );
  });

  it("a malformed (too-short) cookie cannot read another reporter's case", () => {
    const realToken = generateSessionToken();
    const storedCase = makeCase(realToken);

    const malformed = "not-a-valid-token";
    expect(
      verifySessionToken(PEPPER, malformed, storedCase.sessionTokenHash)
    ).toBe(false);
  });

  it("a different valid reporter cookie cannot read another reporter's case", () => {
    const tokenA = generateSessionToken();
    const tokenB = generateSessionToken();

    // tokenB must not access tokenA's case
    const caseForA = makeCase(tokenA);

    expect(
      verifySessionToken(PEPPER, tokenB, caseForA.sessionTokenHash)
    ).toBe(false);
  });

  it("a different valid reporter cookie cannot mutate another reporter's case", () => {
    const tokenA = generateSessionToken();
    const tokenB = generateSessionToken();

    const caseForA = makeCase(tokenA);

    // Mutation guard: same check used before any write
    const canWrite = verifySessionToken(
      PEPPER,
      tokenB,
      caseForA.sessionTokenHash
    );
    expect(canWrite).toBe(false);
  });

  it("the correct token verifies successfully against its own stored hash", () => {
    const token = generateSessionToken();
    const storedCase = makeCase(token);

    expect(verifySessionToken(PEPPER, token, storedCase.sessionTokenHash)).toBe(
      true
    );
  });

  it("constantTimeEqual returns false for strings of different lengths", () => {
    // Different byte lengths — must short-circuit safely
    const a = "aabb";
    const b = "aabbcc";
    expect(constantTimeEqual(a, b)).toBe(false);
  });

  it("constantTimeEqual returns true for identical hex strings", () => {
    const hex = "deadbeef";
    expect(constantTimeEqual(hex, hex)).toBe(true);
  });

  it("constantTimeEqual returns false for different hex strings of the same length", () => {
    expect(constantTimeEqual("deadbeef", "cafebabe")).toBe(false);
  });

  it("workspace tokens are domain-separated from legacy case tokens", () => {
    const token = generateWorkspaceToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(hashWorkspaceToken(PEPPER, token)).not.toBe(
      hashSessionToken(PEPPER, token)
    );
    expect(
      verifyWorkspaceToken(PEPPER, token, hashWorkspaceToken(PEPPER, token))
    ).toBe(true);
    expect(
      verifyWorkspaceToken(PEPPER, generateWorkspaceToken(), hashWorkspaceToken(PEPPER, token))
    ).toBe(false);
  });

  it("workspace expiry is absolute and exactly ten hours after creation", () => {
    const startedAt = new Date("2026-01-01T00:00:00.000Z");
    expect(reporterSessionExpiresAt(startedAt).toISOString()).toBe(
      "2026-01-01T10:00:00.000Z"
    );
  });

  it("normalizes Origin checks without allowing a different port or host", () => {
    expect(
      isAllowedReporterOrigin(
        "https://relief.example.test",
        "https://relief.example.test/"
      )
    ).toBe(true);
    expect(
      isAllowedReporterOrigin(
        "https://attacker.example.test",
        "https://relief.example.test"
      )
    ).toBe(false);
    expect(isAllowedReporterOrigin(null, "https://relief.example.test")).toBe(
      true
    );
  });
});
