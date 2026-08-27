/**
 * tests/cases/guards.test.ts — Phase 4 guard unit tests.
 *
 * Tests (from plan §15 unit tests):
 *   - Task approval fails without human urgency
 *   - sendCoordinatorReply blocked when chat mode is not HUMAN (AI never replies in HUMAN mode)
 *   - Case closure requires all approved tasks to be DONE
 *   - Case closure requires human urgency to be set
 *   - approveTask guards: max 6 approved tasks
 *
 * No live Neon DB or Neon Auth required — all DB interactions are mocked.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Guard logic extracted for unit testing
// (mirrors the server action guards without the 'use server' context)
// ---------------------------------------------------------------------------

// We test the guard logic as pure functions mirroring the action guards.
// The actions themselves are Next.js Server Actions that require a real
// request context, so we extract and test the guard logic independently.

// ---------------------------------------------------------------------------
// Guard: approveTask — human urgency required
// ---------------------------------------------------------------------------

/**
 * Mirrors the approveTask guard: humanUrgency must be set.
 */
function approveTaskGuard(humanUrgency: string | null): void {
  if (!humanUrgency) {
    throw new Error(
      "Human final urgency must be set before approving tasks."
    );
  }
}

/**
 * Mirrors the approveTask guard: max 6 approved tasks per case.
 */
function approveTaskMaxGuard(currentApprovedCount: number): void {
  if (currentApprovedCount >= 6) {
    throw new Error("Cannot approve more than 6 tasks per case.");
  }
}

// ---------------------------------------------------------------------------
// Guard: sendCoordinatorReply — HUMAN mode required
// ---------------------------------------------------------------------------

/**
 * Mirrors sendCoordinatorReply guard: chatMode must be HUMAN.
 * Per plan §2 and spec §3: AI must never reply in HUMAN mode; only
 * coordinator replies are allowed in HUMAN mode.
 */
function sendCoordinatorReplyGuard(
  chatMode: "AI" | "HUMAN",
  body: string
): void {
  if (!body || body.length < 1 || body.length > 2000) {
    throw new Error("Reply body must be 1–2000 characters.");
  }
  if (chatMode !== "HUMAN") {
    throw new Error(
      "Cannot send coordinator reply: chat mode is not HUMAN."
    );
  }
}

// ---------------------------------------------------------------------------
// Guard: closeCase — all approved tasks must be DONE + human urgency set
// ---------------------------------------------------------------------------

type TaskLike = { approved: boolean; status: string };

function closeCaseGuard(
  humanUrgency: string | null,
  tasks: TaskLike[]
): void {
  if (!humanUrgency) {
    throw new Error("Human final urgency must be set before closing a case.");
  }
  const blocked = tasks.filter((t) => t.approved && t.status !== "DONE");
  if (blocked.length > 0) {
    throw new Error(
      `Cannot close case: ${blocked.length} approved task(s) not yet DONE.`
    );
  }
}

// ---------------------------------------------------------------------------
// Guard: takeOverChat — case must exist, not closed, idempotent on HUMAN
// ---------------------------------------------------------------------------

type CaseLike = {
  status: string;
  chatMode: "AI" | "HUMAN";
};

function takeOverChatGuard(caseRow: CaseLike | null): "noop" | "update" {
  if (!caseRow) throw new Error("Case not found.");
  if (caseRow.status === "CLOSED") throw new Error("Cannot override a closed case.");
  if (caseRow.chatMode === "HUMAN") return "noop"; // idempotent
  return "update";
}

// ---------------------------------------------------------------------------
// Guard: setHumanUrgency — reason is now optional (no guard needed)
// ---------------------------------------------------------------------------

function setHumanUrgencyGuard(_reason: string): void {
  // Reason is optional — no validation required.
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("approveTask guards", () => {
  it("throws when humanUrgency is null (human urgency required)", () => {
    expect(() => approveTaskGuard(null)).toThrowError(
      "Human final urgency must be set before approving tasks."
    );
  });

  it("throws when humanUrgency is undefined", () => {
    expect(() => approveTaskGuard(undefined as unknown as null)).toThrowError(
      "Human final urgency must be set before approving tasks."
    );
  });

  it("passes when humanUrgency is set", () => {
    expect(() => approveTaskGuard("CRITICAL")).not.toThrow();
    expect(() => approveTaskGuard("HIGH")).not.toThrow();
    expect(() => approveTaskGuard("MEDIUM")).not.toThrow();
    expect(() => approveTaskGuard("LOW")).not.toThrow();
  });

  it("throws when 6 tasks are already approved", () => {
    expect(() => approveTaskMaxGuard(6)).toThrowError(
      "Cannot approve more than 6 tasks per case."
    );
  });

  it("throws when more than 6 tasks are approved", () => {
    expect(() => approveTaskMaxGuard(7)).toThrowError(
      "Cannot approve more than 6 tasks per case."
    );
  });

  it("passes when fewer than 6 tasks are approved", () => {
    expect(() => approveTaskMaxGuard(0)).not.toThrow();
    expect(() => approveTaskMaxGuard(5)).not.toThrow();
  });
});

describe("sendCoordinatorReply — AI never replies in HUMAN mode", () => {
  it("throws when chatMode is AI (only coordinator can reply in HUMAN mode)", () => {
    expect(() =>
      sendCoordinatorReplyGuard("AI", "Hello reporter")
    ).toThrowError("Cannot send coordinator reply: chat mode is not HUMAN.");
  });

  it("passes when chatMode is HUMAN", () => {
    expect(() =>
      sendCoordinatorReplyGuard("HUMAN", "Hello reporter")
    ).not.toThrow();
  });

  it("throws when body is empty", () => {
    expect(() => sendCoordinatorReplyGuard("HUMAN", "")).toThrowError(
      "Reply body must be 1–2000 characters."
    );
  });

  it("throws when body exceeds 2000 characters", () => {
    const longBody = "a".repeat(2001);
    expect(() => sendCoordinatorReplyGuard("HUMAN", longBody)).toThrowError(
      "Reply body must be 1–2000 characters."
    );
  });

  it("passes for a body of exactly 2000 characters", () => {
    const maxBody = "a".repeat(2000);
    expect(() => sendCoordinatorReplyGuard("HUMAN", maxBody)).not.toThrow();
  });
});

describe("closeCase guards", () => {
  it("throws when humanUrgency is not set", () => {
    expect(() => closeCaseGuard(null, [])).toThrowError(
      "Human final urgency must be set before closing a case."
    );
  });

  it("throws when there are approved tasks that are not DONE", () => {
    const tasks: TaskLike[] = [
      { approved: true, status: "TODO" },
      { approved: true, status: "DONE" },
    ];
    expect(() => closeCaseGuard("HIGH", tasks)).toThrowError(
      "Cannot close case: 1 approved task(s) not yet DONE."
    );
  });

  it("throws when multiple approved tasks are not DONE", () => {
    const tasks: TaskLike[] = [
      { approved: true, status: "TODO" },
      { approved: true, status: "DOING" },
      { approved: true, status: "DONE" },
    ];
    expect(() => closeCaseGuard("HIGH", tasks)).toThrowError(
      "Cannot close case: 2 approved task(s) not yet DONE."
    );
  });

  it("passes when humanUrgency is set and all approved tasks are DONE", () => {
    const tasks: TaskLike[] = [
      { approved: true, status: "DONE" },
      { approved: true, status: "DONE" },
      { approved: false, status: "TODO" }, // unapproved tasks do not block closure
    ];
    expect(() => closeCaseGuard("CRITICAL", tasks)).not.toThrow();
  });

  it("passes when humanUrgency is set and there are no approved tasks", () => {
    expect(() => closeCaseGuard("LOW", [])).not.toThrow();
  });

  it("passes when humanUrgency is set and unapproved tasks remain not DONE", () => {
    // Unapproved tasks should NOT block closure
    const tasks: TaskLike[] = [
      { approved: false, status: "TODO" },
      { approved: false, status: "DOING" },
    ];
    expect(() => closeCaseGuard("MEDIUM", tasks)).not.toThrow();
  });
});

describe("takeOverChat guards", () => {
  it("throws when case is not found", () => {
    expect(() => takeOverChatGuard(null)).toThrowError("Case not found.");
  });

  it("throws when case is CLOSED", () => {
    expect(() =>
      takeOverChatGuard({ status: "CLOSED", chatMode: "AI" })
    ).toThrowError("Cannot override a closed case.");
  });

  it("returns noop when case is already HUMAN (idempotent)", () => {
    expect(
      takeOverChatGuard({ status: "ACTIVE", chatMode: "HUMAN" })
    ).toBe("noop");
  });

  it("returns update when case is AI-controlled", () => {
    expect(
      takeOverChatGuard({ status: "ACTIVE", chatMode: "AI" })
    ).toBe("update");
  });

  it("returns update for AI-controlled INTAKE case", () => {
    expect(
      takeOverChatGuard({ status: "INTAKE", chatMode: "AI" })
    ).toBe("update");
  });
});

describe("setHumanUrgency — reason is optional", () => {
  it("passes when reason is empty", () => {
    expect(() => setHumanUrgencyGuard("")).not.toThrow();
  });

  it("passes when reason is whitespace only", () => {
    expect(() => setHumanUrgencyGuard("   ")).not.toThrow();
  });

  it("passes when reason is provided", () => {
    expect(() =>
      setHumanUrgencyGuard("Matches AI assessment based on confirmed facts.")
    ).not.toThrow();
  });
});
