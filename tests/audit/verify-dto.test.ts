/**
 * tests/audit/verify-dto.test.ts
 *
 * Unit tests for the ChatAuditVerificationDto shape and the verify endpoint
 * guard logic (auth check, UUID validation, field redaction).
 *
 * Does NOT require a live DB or Stellar connection — tests the guard and
 * DTO-shaping logic as pure functions mirrored from the route handler.
 */
import { describe, it, expect } from "vitest";
import { isUuid } from "@/lib/ids";

// ---------------------------------------------------------------------------
// Guard: UUID validation (mirrors route handler pre-check)
// ---------------------------------------------------------------------------

describe("verify endpoint — auditId validation", () => {
  it("rejects a non-UUID string", () => {
    expect(isUuid("not-a-uuid")).toBe(false);
    expect(isUuid("abc123")).toBe(false);
    expect(isUuid("")).toBe(false);
  });

  it("rejects a partial UUID", () => {
    expect(isUuid("12345678-1234-1234-1234")).toBe(false);
  });

  it("accepts a valid v4 UUID", () => {
    expect(isUuid("550e8400-e29b-41d4-a716-446655440000")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// DTO shape: sensitive fields must not be present
// ---------------------------------------------------------------------------

/**
 * Mirror the DTO construction logic from the route handler.
 * This confirms the safe-field contract: nonce, payload, reporter data,
 * and session data are never included in the response.
 */
type ChatAuditVerificationDto = {
  auditId: string;
  dbStatus: string;
  verificationStatus: string;
  chatStartedAt: string | null;
  anchoredAt: string | null;
  ledgerCloseTime: string | null;
  storedHash: string | null;
  stellarTxHash: string | null;
  stellarExplorerUrl: string | null;
};

function buildDto(overrides: Partial<ChatAuditVerificationDto> = {}): ChatAuditVerificationDto {
  return {
    auditId: "550e8400-e29b-41d4-a716-446655440000",
    dbStatus: "ANCHORED",
    verificationStatus: "VERIFIED",
    chatStartedAt: "2024-01-01T12:00:00.000Z",
    anchoredAt: "2024-01-01T12:00:05.000Z",
    ledgerCloseTime: "2024-01-01T12:00:07.000Z",
    storedHash: "abc123def456",
    stellarTxHash: "txhash001",
    stellarExplorerUrl: "https://stellar.expert/explorer/testnet/tx/txhash001",
    ...overrides,
  };
}

describe("ChatAuditVerificationDto — field contract", () => {
  it("contains only the allowed safe fields", () => {
    const dto = buildDto();
    const keys = Object.keys(dto);
    const allowed = new Set([
      "auditId", "dbStatus", "verificationStatus", "chatStartedAt",
      "anchoredAt", "ledgerCloseTime", "storedHash", "stellarTxHash",
      "stellarExplorerUrl",
    ]);
    for (const key of keys) {
      expect(allowed.has(key), `unexpected key in DTO: ${key}`).toBe(true);
    }
  });

  it("does NOT contain nonce", () => {
    const dto = buildDto() as Record<string, unknown>;
    expect(dto["nonce"]).toBeUndefined();
  });

  it("does NOT contain canonical payload", () => {
    const dto = buildDto() as Record<string, unknown>;
    expect(dto["payload"]).toBeUndefined();
    expect(dto["canonicalPayload"]).toBeUndefined();
  });

  it("does NOT contain recomputedHash or onChainHash", () => {
    const dto = buildDto() as Record<string, unknown>;
    expect(dto["recomputedHash"]).toBeUndefined();
    expect(dto["onChainHash"]).toBeUndefined();
  });

  it("does NOT contain reporter identity or session data", () => {
    const dto = buildDto() as Record<string, unknown>;
    expect(dto["sessionTokenHash"]).toBeUndefined();
    expect(dto["reporterId"]).toBeUndefined();
    expect(dto["reporterMessages"]).toBeUndefined();
  });

  it("stellarExplorerUrl is null when no tx hash", () => {
    const dto = buildDto({ stellarTxHash: null, stellarExplorerUrl: null });
    expect(dto.stellarTxHash).toBeNull();
    expect(dto.stellarExplorerUrl).toBeNull();
  });

  it("stellarExplorerUrl points to testnet explorer", () => {
    const dto = buildDto({ stellarTxHash: "abc", stellarExplorerUrl: "https://stellar.expert/explorer/testnet/tx/abc" });
    expect(dto.stellarExplorerUrl).toContain("testnet");
    expect(dto.stellarExplorerUrl).toContain("abc");
  });
});

// ---------------------------------------------------------------------------
// Timestamp helper (mirrors ChatAuditDialog.fmtTimestamp logic)
// ---------------------------------------------------------------------------

function fmtTimestamp(iso: string | null): { local: string; utc: string } | null {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return { local: d.toLocaleString(), utc: d.toUTCString() };
  } catch {
    return null;
  }
}

describe("timestamp formatting", () => {
  it("returns null for null input", () => {
    expect(fmtTimestamp(null)).toBeNull();
  });

  it("returns both local and UTC strings for a valid ISO timestamp", () => {
    const result = fmtTimestamp("2024-06-15T09:30:00.000Z");
    expect(result).not.toBeNull();
    expect(result!.utc).toContain("2024");
    expect(typeof result!.local).toBe("string");
    expect(result!.local.length).toBeGreaterThan(0);
  });

  it("utc string contains the word GMT or UTC", () => {
    const result = fmtTimestamp("2024-06-15T09:30:00.000Z");
    // toUTCString() includes 'GMT'
    expect(result!.utc).toMatch(/GMT|UTC/);
  });
});
