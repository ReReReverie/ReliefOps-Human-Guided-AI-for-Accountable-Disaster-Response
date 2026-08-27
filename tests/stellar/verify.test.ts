/**
 * tests/stellar/verify.test.ts — Public audit verification input handling.
 *
 * The database is mocked so these tests never require Postgres or Horizon.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb } = vi.hoisted(() => ({
  getDb: vi.fn(),
}));

vi.mock("@/lib/db", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/db")>();
  return { ...actual, getDb };
});

import { verifyAuditRecord } from "@/lib/stellar/verify";

const VALID_AUDIT_ID = "123e4567-e89b-12d3-a456-426614174000";

describe("verifyAuditRecord", () => {
  beforeEach(() => {
    getDb.mockReset();
  });

  it("returns the safe NOT_FOUND shape for malformed IDs without touching the database", async () => {
    const result = await verifyAuditRecord("not-a-real-audit-id");

    expect(result).toEqual({
      status: "NOT_FOUND",
      auditId: "not-a-real-audit-id",
      storedHash: null,
      recomputedHash: null,
      onChainHash: null,
      firstMessageAt: null,
      ledgerCloseTime: null,
      stellarTxHash: null,
    });
    expect(getDb).not.toHaveBeenCalled();
  });

  it("preserves the database-backed path for a valid UUID", async () => {
    const findFirst = vi.fn().mockResolvedValue({
      status: "PENDING",
      recordHash: "record-hash",
      firstMessageAt: new Date("2024-08-01T12:00:00.000Z"),
      ledgerCloseTime: null,
      stellarTxHash: null,
    });
    getDb.mockReturnValue({
      query: { auditRecords: { findFirst } },
    });

    const result = await verifyAuditRecord(VALID_AUDIT_ID);

    expect(getDb).toHaveBeenCalledOnce();
    expect(findFirst).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      status: "NOT_ANCHORED",
      auditId: VALID_AUDIT_ID,
      storedHash: "record-hash",
      stellarTxHash: null,
    });
  });
});
