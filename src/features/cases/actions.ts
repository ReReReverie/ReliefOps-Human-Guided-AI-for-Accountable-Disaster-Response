"use server";
/**
 * src/features/cases/actions.ts — All coordinator Server Actions.
 *
 * Rules (from plan §5, §6, §7):
 *   - Every action validates Neon Auth session + profiles.role = COORDINATOR independently.
 *   - SameSite=Lax on session cookies reduces CSRF; actions still check Origin via
 *     Next.js server action infrastructure (POST-only, no cross-origin).
 *   - Guards are enforced in server code per plan §7.
 *
 * Server-only — never import in browser code.
 */
import { revalidatePath } from "next/cache";
import { eq, and, count } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireCoordinatorSession } from "@/lib/auth/coordinator";

// ---------------------------------------------------------------------------
// Types (matching schema enums)
// ---------------------------------------------------------------------------

export type UrgencyLevel = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type TaskStatus = "TODO" | "DOING" | "DONE";
export type CaseStatus = "INTAKE" | "REVIEW" | "ACTIVE" | "CLOSED";

// ---------------------------------------------------------------------------
// Helper: Authenticate and return coordinator or throw
// ---------------------------------------------------------------------------

async function getAuthenticatedCoordinator(): Promise<{
  userId: string;
  displayName: string;
}> {
  const result = await requireCoordinatorSession();
  if (!result.ok) {
    throw new Error("Unauthorized");
  }
  return { userId: result.userId, displayName: result.displayName };
}

// ---------------------------------------------------------------------------
// takeOverChat
// ---------------------------------------------------------------------------

/**
 * Set relief_cases.chatMode = 'HUMAN' for the given case.
 */
export async function takeOverChat(caseId: string): Promise<void> {
  await getAuthenticatedCoordinator();
  const db = getDb();
  await db
    .update(schema.reliefCases)
    .set({ chatMode: "HUMAN", updatedAt: new Date() })
    .where(eq(schema.reliefCases.id, caseId));
  revalidatePath(`/ops/cases/${caseId}`);
}

// ---------------------------------------------------------------------------
// resumeAi
// ---------------------------------------------------------------------------

/**
 * Set relief_cases.chatMode = 'AI'.
 */
export async function resumeAi(caseId: string): Promise<void> {
  await getAuthenticatedCoordinator();
  const db = getDb();
  await db
    .update(schema.reliefCases)
    .set({ chatMode: "AI", updatedAt: new Date() })
    .where(eq(schema.reliefCases.id, caseId));
  revalidatePath(`/ops/cases/${caseId}`);
}

// ---------------------------------------------------------------------------
// sendCoordinatorReply
// ---------------------------------------------------------------------------

/**
 * Insert a COORDINATOR message.
 * Only allowed when chatMode = 'HUMAN'.
 * Body: 1–2000 chars.
 */
export async function sendCoordinatorReply(
  caseId: string,
  body: string
): Promise<void> {
  const coordinator = await getAuthenticatedCoordinator();

  if (!body || body.length < 1 || body.length > 2000) {
    throw new Error("Reply body must be 1–2000 characters.");
  }

  const db = getDb();

  // Guard: only allowed in HUMAN chat mode
  const caseRow = await db.query.reliefCases.findFirst({
    where: eq(schema.reliefCases.id, caseId),
  });
  if (!caseRow) throw new Error("Case not found.");
  if (caseRow.chatMode !== "HUMAN") {
    throw new Error(
      "Cannot send coordinator reply: chat mode is not HUMAN."
    );
  }

  await db.insert(schema.messages).values({
    caseId,
    senderType: "COORDINATOR",
    senderUserId: coordinator.userId,
    body,
  });

  revalidatePath(`/ops/cases/${caseId}`);
}

// ---------------------------------------------------------------------------
// setHumanUrgency
// ---------------------------------------------------------------------------

/**
 * Record human final urgency.
 * - Inserts urgency_assessments row with source = 'HUMAN'.
 * - Updates relief_cases.humanUrgency.
 * - Moves case from INTAKE → REVIEW if still in INTAKE.
 * - If level differs from latest AI suggestion, reason must be non-empty.
 * - reason is required in all cases (plan §9).
 */
export async function setHumanUrgency(
  caseId: string,
  level: UrgencyLevel,
  reason: string
): Promise<void> {
  const coordinator = await getAuthenticatedCoordinator();

  if (!reason || reason.trim().length === 0) {
    throw new Error("A reason is required for human urgency assessment.");
  }

  const db = getDb();

  // If level differs from latest AI suggestion, reason must be non-empty (already checked above)
  // Load latest AI assessment to compare
  const aiAssessments = await db.query.urgencyAssessments.findMany({
    where: and(
      eq(schema.urgencyAssessments.caseId, caseId),
      eq(schema.urgencyAssessments.source, "AI")
    ),
    orderBy: (a, { desc }) => [desc(a.createdAt)],
  });
  const latestAi = aiAssessments[0];

  if (latestAi && latestAi.urgencyLevel !== level) {
    // reason is already validated as non-empty above
  }

  // Insert human urgency assessment
  await db.insert(schema.urgencyAssessments).values({
    caseId,
    source: "HUMAN",
    urgencyLevel: level,
    factorBreakdown: [],
    confidence: null,
    missingInformation: null,
    rationale: reason.trim(),
    humanActorId: coordinator.userId,
  });

  // Update case humanUrgency and possibly move INTAKE → REVIEW
  const caseRow = await db.query.reliefCases.findFirst({
    where: eq(schema.reliefCases.id, caseId),
  });
  if (!caseRow) throw new Error("Case not found.");

  const newStatus =
    caseRow.status === "INTAKE" ? "REVIEW" : caseRow.status;

  await db
    .update(schema.reliefCases)
    .set({ humanUrgency: level, status: newStatus, updatedAt: new Date() })
    .where(eq(schema.reliefCases.id, caseId));

  revalidatePath(`/ops/cases/${caseId}`);
  revalidatePath("/ops");
}

// ---------------------------------------------------------------------------
// approveTask
// ---------------------------------------------------------------------------

/**
 * Set tasks.approved = true.
 * Guard: relief_cases.humanUrgency must not be null.
 * Guard: count of already-approved tasks must be < 6.
 */
export async function approveTask(taskId: string): Promise<void> {
  await getAuthenticatedCoordinator();
  const db = getDb();

  const task = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, taskId),
  });
  if (!task) throw new Error("Task not found.");

  // Guard: human urgency required
  const caseRow = await db.query.reliefCases.findFirst({
    where: eq(schema.reliefCases.id, task.caseId),
  });
  if (!caseRow) throw new Error("Case not found.");
  if (!caseRow.humanUrgency) {
    throw new Error(
      "Human final urgency must be set before approving tasks."
    );
  }

  // Guard: max 6 approved tasks per case
  const approvedCountResult = await db
    .select({ cnt: count() })
    .from(schema.tasks)
    .where(
      and(
        eq(schema.tasks.caseId, task.caseId),
        eq(schema.tasks.approved, true)
      )
    );
  const approvedCount = approvedCountResult[0]?.cnt ?? 0;
  if (approvedCount >= 6) {
    throw new Error("Cannot approve more than 6 tasks per case.");
  }

  await db
    .update(schema.tasks)
    .set({ approved: true, updatedAt: new Date() })
    .where(eq(schema.tasks.id, taskId));

  revalidatePath(`/ops/cases/${task.caseId}`);
}

// ---------------------------------------------------------------------------
// updateTaskStatus
// ---------------------------------------------------------------------------

/**
 * Update tasks.status.
 * Valid transitions: TODO → DOING, DOING → DONE (and reversal for coordinator control).
 */
export async function updateTaskStatus(
  taskId: string,
  status: TaskStatus
): Promise<void> {
  await getAuthenticatedCoordinator();
  const db = getDb();

  const task = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, taskId),
  });
  if (!task) throw new Error("Task not found.");

  await db
    .update(schema.tasks)
    .set({ status, updatedAt: new Date() })
    .where(eq(schema.tasks.id, taskId));

  revalidatePath(`/ops/cases/${task.caseId}`);
}

// ---------------------------------------------------------------------------
// saveTask
// ---------------------------------------------------------------------------

/**
 * Update task title/details/proposedOwner (unapproved tasks only).
 * title: 1–120 chars; details: max 500 chars.
 */
export async function saveTask(
  taskId: string,
  {
    title,
    details,
    proposedOwner,
  }: { title: string; details?: string; proposedOwner?: string }
): Promise<void> {
  await getAuthenticatedCoordinator();

  if (!title || title.trim().length === 0 || title.trim().length > 120) {
    throw new Error("Task title must be 1–120 characters.");
  }
  if (details && details.length > 500) {
    throw new Error("Task details must be at most 500 characters.");
  }

  const db = getDb();

  const task = await db.query.tasks.findFirst({
    where: eq(schema.tasks.id, taskId),
  });
  if (!task) throw new Error("Task not found.");
  if (task.approved) {
    throw new Error("Cannot edit an approved task.");
  }

  await db
    .update(schema.tasks)
    .set({
      title: title.trim(),
      details: details ?? null,
      proposedOwner: proposedOwner ?? null,
      updatedAt: new Date(),
    })
    .where(eq(schema.tasks.id, taskId));

  revalidatePath(`/ops/cases/${task.caseId}`);
}

// ---------------------------------------------------------------------------
// addTask
// ---------------------------------------------------------------------------

/**
 * Insert a new task with next position value.
 * Guard: max 6 approved tasks per case (count approved before insert).
 */
export async function addTask(
  caseId: string,
  {
    title,
    details,
    proposedOwner,
  }: { title: string; details?: string; proposedOwner?: string }
): Promise<void> {
  await getAuthenticatedCoordinator();

  if (!title || title.trim().length === 0 || title.trim().length > 120) {
    throw new Error("Task title must be 1–120 characters.");
  }
  if (details && details.length > 500) {
    throw new Error("Task details must be at most 500 characters.");
  }

  const db = getDb();

  // Guard: max 6 approved tasks per case
  const approvedCountResult = await db
    .select({ cnt: count() })
    .from(schema.tasks)
    .where(
      and(eq(schema.tasks.caseId, caseId), eq(schema.tasks.approved, true))
    );
  const approvedCount = approvedCountResult[0]?.cnt ?? 0;
  if (approvedCount >= 6) {
    throw new Error("Cannot add task: maximum of 6 approved tasks reached.");
  }

  // Determine next position
  const existingTasks = await db.query.tasks.findMany({
    where: eq(schema.tasks.caseId, caseId),
    orderBy: (t, { desc }) => [desc(t.position)],
  });
  const nextPosition = existingTasks.length > 0 ? (existingTasks[0].position + 1) : 0;

  await db.insert(schema.tasks).values({
    caseId,
    title: title.trim(),
    details: details ?? null,
    proposedOwner: proposedOwner ?? null,
    position: nextPosition,
    status: "TODO",
    approved: false,
  });

  revalidatePath(`/ops/cases/${caseId}`);
}

// ---------------------------------------------------------------------------
// closeCase
// ---------------------------------------------------------------------------

/**
 * Set relief_cases.status = 'CLOSED'.
 * Guard: every task with approved = true must have status = 'DONE'.
 * Guard: human urgency must be set.
 */
export async function closeCase(caseId: string): Promise<void> {
  await getAuthenticatedCoordinator();
  const db = getDb();

  const caseRow = await db.query.reliefCases.findFirst({
    where: eq(schema.reliefCases.id, caseId),
  });
  if (!caseRow) throw new Error("Case not found.");

  // Guard: human urgency required
  if (!caseRow.humanUrgency) {
    throw new Error("Human final urgency must be set before closing a case.");
  }

  // Guard: all approved tasks must be DONE
  const approvedNotDone = await db.query.tasks.findMany({
    where: and(
      eq(schema.tasks.caseId, caseId),
      eq(schema.tasks.approved, true)
    ),
  });
  const blocked = approvedNotDone.filter((t) => t.status !== "DONE");
  if (blocked.length > 0) {
    throw new Error(
      `Cannot close case: ${blocked.length} approved task(s) not yet DONE.`
    );
  }

  await db
    .update(schema.reliefCases)
    .set({ status: "CLOSED", updatedAt: new Date() })
    .where(eq(schema.reliefCases.id, caseId));

  revalidatePath(`/ops/cases/${caseId}`);
  revalidatePath("/ops");
}

// ---------------------------------------------------------------------------
// setCaseStatus
// ---------------------------------------------------------------------------

/**
 * Move case REVIEW → ACTIVE (coordinator only).
 */
export async function setCaseStatus(
  caseId: string,
  status: CaseStatus
): Promise<void> {
  await getAuthenticatedCoordinator();
  const db = getDb();

  const caseRow = await db.query.reliefCases.findFirst({
    where: eq(schema.reliefCases.id, caseId),
  });
  if (!caseRow) throw new Error("Case not found.");

  // Only coordinator-controlled transitions
  if (status === "ACTIVE" && caseRow.status !== "REVIEW") {
    throw new Error("Case must be in REVIEW to move to ACTIVE.");
  }

  await db
    .update(schema.reliefCases)
    .set({ status, updatedAt: new Date() })
    .where(eq(schema.reliefCases.id, caseId));

  revalidatePath(`/ops/cases/${caseId}`);
  revalidatePath("/ops");
}
