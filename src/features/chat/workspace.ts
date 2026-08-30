/**
 * Server-only reporter workspace authorization and history helpers.
 *
 * A workspace is identified by a random HttpOnly cookie. The raw value never
 * reaches the database; only a domain-separated HMAC is stored. Every lookup
 * checks both the workspace's absolute deadline and the case's own deadline.
 */
import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  isNull,
  lt,
  or,
} from "drizzle-orm";

import { getDb, schema } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import {
  constantTimeEqual,
  generateWorkspaceToken,
  hashSessionToken,
  hashWorkspaceToken,
  reporterSessionExpiresAt,
  verifySessionToken,
  verifyWorkspaceToken,
} from "@/lib/auth/reporter";

// Re-exporting the cookie name from the auth module keeps route handlers from
// having to know the persistence details.
export {
  REPORTER_SESSION_MAX_AGE_MS,
  REPORTER_SESSION_MAX_AGE_SECONDS,
  WORKSPACE_COOKIE_NAME,
} from "@/lib/auth/reporter";

export const HISTORY_DEFAULT_LIMIT = 20;
export const HISTORY_MAX_LIMIT = 50;
const CURSOR_DOMAIN = "reliefops/reporter-history-cursor/v1:";

export type ReporterWorkspaceContext = {
  id: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
};

export type WorkspaceResolution = {
  workspace: ReporterWorkspaceContext;
  /** Raw token to set in the response cookie when a workspace was created. */
  rawToken: string | null;
  /** Case associated during legacy migration, if any. */
  adoptedCaseId: string | null;
  created: boolean;
};

export type ReporterTranscriptMessage = {
  id: string;
  senderType: "REPORTER" | "AI" | "COORDINATOR";
  body: string;
  createdAt: Date;
};

function getPepper(): string {
  const pepper = process.env["REPORTER_SESSION_PEPPER"];
  if (!pepper) throw new Error("REPORTER_SESSION_PEPPER is not configured");
  return pepper;
}

function asDate(value: Date | string): Date {
  return value instanceof Date ? value : new Date(value);
}

function activeWorkspace(
  workspace: ReporterWorkspaceContext,
  now: Date
): boolean {
  return !workspace.revokedAt && workspace.expiresAt.getTime() > now.getTime();
}

function toWorkspaceContext(row: {
  id: string;
  createdAt: Date;
  expiresAt: Date;
  revokedAt: Date | null;
}): ReporterWorkspaceContext {
  return {
    id: row.id,
    createdAt: asDate(row.createdAt),
    expiresAt: asDate(row.expiresAt),
    revokedAt: row.revokedAt ? asDate(row.revokedAt) : null,
  };
}

function validTokenShape(value: string | undefined): value is string {
  return Boolean(value && /^[0-9a-f]{64}$/i.test(value));
}

/** Resolve a non-expired workspace cookie without creating a new workspace. */
export async function getActiveReporterWorkspace(
  rawToken: string | undefined,
  now = new Date()
): Promise<ReporterWorkspaceContext | null> {
  if (!validTokenShape(rawToken)) return null;

  const db = getDb();
  const pepper = getPepper();
  const row = await db.query.reporterWorkspaces.findFirst({
    where: eq(schema.reporterWorkspaces.tokenHash, hashWorkspaceToken(pepper, rawToken)),
  });
  if (!row) return null;

  const workspace = toWorkspaceContext(row);
  if (!activeWorkspace(workspace, now)) return null;
  if (!verifyWorkspaceToken(pepper, rawToken, row.tokenHash)) return null;
  return workspace;
}

async function loadLegacyCase(
  rawToken: string | undefined,
  now: Date
): Promise<typeof schema.reliefCases.$inferSelect | null> {
  if (!validTokenShape(rawToken)) return null;

  const db = getDb();
  const pepper = getPepper();
  const tokenHash = hashSessionToken(pepper, rawToken);
  const row = await db.query.reliefCases.findFirst({
    where: eq(schema.reliefCases.sessionTokenHash, tokenHash),
  });
  if (!row || !verifySessionToken(pepper, rawToken, row.sessionTokenHash)) {
    return null;
  }

  const expiresAt = asDate(row.reporterSessionExpiresAt);
  if (expiresAt.getTime() <= now.getTime()) return null;
  return row;
}

async function latestCaseId(
  workspaceId: string,
  now: Date
): Promise<string | null> {
  const db = getDb();
  const row = await db.query.reliefCases.findFirst({
    where: and(
      eq(schema.reliefCases.reporterWorkspaceId, workspaceId),
      gt(schema.reliefCases.reporterSessionExpiresAt, now)
    ),
    orderBy: [desc(schema.reliefCases.updatedAt), desc(schema.reliefCases.id)],
    columns: { id: true },
  });
  return row?.id ?? null;
}

async function createWorkspace(
  expiresAt: Date,
  now: Date,
  adoptedCaseId: string | null = null
): Promise<WorkspaceResolution> {
  const db = getDb();
  const rawToken = generateWorkspaceToken();
  const [row] = await db
    .insert(schema.reporterWorkspaces)
    .values({
      tokenHash: hashWorkspaceToken(getPepper(), rawToken),
      createdAt: now,
      expiresAt,
    })
    .returning();

  if (!row) throw new Error("WORKSPACE_CREATE_FAILED");
  return {
    workspace: toWorkspaceContext(row),
    rawToken,
    adoptedCaseId,
    created: true,
  };
}

/**
 * Resolve or create a workspace for a browser.
 *
 * A valid workspace cookie always wins. If a cookie is present but expired,
 * revoked, or malformed, it is never replaced by adopting the legacy cookie:
 * doing so would provide an expiry bypass. Legacy adoption is allowed only
 * when no workspace cookie was sent, and only for the one case proved by that
 * legacy token. Existing workspace membership is never moved between owners.
 */
export async function ensureReporterWorkspace({
  workspaceToken,
  legacySessionToken,
  now = new Date(),
}: {
  workspaceToken?: string;
  legacySessionToken?: string;
  now?: Date;
} = {}): Promise<WorkspaceResolution> {
  const existing = await getActiveReporterWorkspace(workspaceToken, now);
  if (existing) {
    return {
      workspace: existing,
      rawToken: null,
      adoptedCaseId: await latestCaseId(existing.id, now),
      created: false,
    };
  }

  // Do not use a legacy cookie to bypass an expired/revoked workspace.
  // An explicitly supplied (even empty or malformed) workspace cookie must
  // never be treated as absent. Otherwise a stale/invalid workspace cookie
  // could fall back to the legacy cookie and silently adopt a case, bypassing
  // the workspace's expiry or revocation boundary.
  if (workspaceToken === undefined) {
    const legacyCase = await loadLegacyCase(legacySessionToken, now);
    if (legacyCase && !legacyCase.reporterWorkspaceId) {
      const expiresAt = asDate(legacyCase.reporterSessionExpiresAt);
      const rawToken = generateWorkspaceToken();
      const db = getDb();
      const [workspaceRow, associatedCaseId] = await db.transaction(async (tx) => {
        const [createdRow] = await tx
          .insert(schema.reporterWorkspaces)
          .values({
            tokenHash: hashWorkspaceToken(getPepper(), rawToken),
            createdAt: now,
            expiresAt,
          })
          .returning();

        if (!createdRow) return [undefined, null] as const;
        const [associatedCase] = await tx
          .update(schema.reliefCases)
          .set({ reporterWorkspaceId: createdRow.id })
          .where(
            and(
              eq(schema.reliefCases.id, legacyCase.id),
              isNull(schema.reliefCases.reporterWorkspaceId)
            )
          )
          .returning({ id: schema.reliefCases.id });
        return [createdRow, associatedCase?.id ?? null] as const;
      });

      if (workspaceRow) {
        return {
          workspace: toWorkspaceContext(workspaceRow),
          rawToken,
          adoptedCaseId: associatedCaseId,
          created: true,
        };
      }
    }
  }

  return createWorkspace(reporterSessionExpiresAt(now), now);
}

/** Return the remaining client-cookie lifetime without ever extending access. */
export function workspaceCookieMaxAge(expiresAt: Date, now = new Date()): number {
  return Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / 1000));
}

/** Authorize a case only through active workspace membership and expiry. */
export async function authorizeReporterCase(
  workspace: ReporterWorkspaceContext,
  caseId: string,
  now = new Date()
): Promise<typeof schema.reliefCases.$inferSelect | null> {
  if (!isUuid(caseId) || !activeWorkspace(workspace, now)) return null;

  const db = getDb();
  const row = await db.query.reliefCases.findFirst({
    where: and(
      eq(schema.reliefCases.id, caseId),
      eq(schema.reliefCases.reporterWorkspaceId, workspace.id),
      gt(schema.reliefCases.reporterSessionExpiresAt, now)
    ),
  });
  return row ?? null;
}

function encodeCursorValue(cursor: { lastActivityAt: Date; caseId: string }): string {
  const payload = JSON.stringify({
    lastActivityAt: cursor.lastActivityAt.toISOString(),
    caseId: cursor.caseId,
  });
  const encoded = Buffer.from(payload, "utf8").toString("base64url");
  const signature = hashSessionToken(getPepper(), `${CURSOR_DOMAIN}${encoded}`);
  return `${encoded}.${signature}`;
}

export function encodeHistoryCursor(cursor: {
  lastActivityAt: Date;
  caseId: string;
}): string {
  return encodeCursorValue(cursor);
}

export function decodeHistoryCursor(
  value: string | null | undefined
): { lastActivityAt: Date; caseId: string } | null {
  if (!value || value.length > 512) return null;
  const [encoded, signature, extra] = value.split(".");
  if (!encoded || !signature || extra || !/^[0-9a-f]{64}$/i.test(signature)) {
    return null;
  }
  if (
    !constantTimeEqual(
      signature,
      hashSessionToken(getPepper(), `${CURSOR_DOMAIN}${encoded}`)
    )
  ) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    );
    if (!parsed || typeof parsed !== "object") return null;
    const candidate = parsed as { lastActivityAt?: unknown; caseId?: unknown };
    if (typeof candidate.lastActivityAt !== "string" || typeof candidate.caseId !== "string") {
      return null;
    }
    if (!isUuid(candidate.caseId)) return null;
    const date = new Date(candidate.lastActivityAt);
    if (Number.isNaN(date.getTime())) return null;
    return { lastActivityAt: date, caseId: candidate.caseId };
  } catch {
    return null;
  }
}

export type ReporterHistoryItem = {
  caseId: string;
  publicRef: string;
  status: string;
  chatMode: string;
  createdAt: Date;
  lastActivityAt: Date;
  messageCount: number;
};

export async function listReporterHistory(
  workspace: ReporterWorkspaceContext,
  {
    cursor,
    limit,
    now = new Date(),
  }: {
    cursor?: string | null;
    limit: number;
    now?: Date;
  }
): Promise<{ items: ReporterHistoryItem[]; nextCursor: string | null }> {
  if (!activeWorkspace(workspace, now)) {
    throw new Error("WORKSPACE_EXPIRED");
  }
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > HISTORY_MAX_LIMIT
  ) {
    throw new Error("INVALID_HISTORY_LIMIT");
  }

  const decodedCursor = decodeHistoryCursor(cursor);
  if (cursor && !decodedCursor) throw new Error("INVALID_HISTORY_CURSOR");

  const db = getDb();
  const filters = [
    eq(schema.reliefCases.reporterWorkspaceId, workspace.id),
    gt(schema.reliefCases.reporterSessionExpiresAt, now),
  ];
  if (decodedCursor) {
    filters.push(
      or(
        lt(schema.reliefCases.updatedAt, decodedCursor.lastActivityAt),
        and(
          eq(schema.reliefCases.updatedAt, decodedCursor.lastActivityAt),
          lt(schema.reliefCases.id, decodedCursor.caseId)
        )
      )!
    );
  }

  const rows = await db
    .select({
      caseId: schema.reliefCases.id,
      publicRef: schema.reliefCases.publicRef,
      status: schema.reliefCases.status,
      chatMode: schema.reliefCases.chatMode,
      createdAt: schema.reliefCases.createdAt,
      lastActivityAt: schema.reliefCases.updatedAt,
      messageCount: count(schema.messages.id),
    })
    .from(schema.reliefCases)
    .leftJoin(
      schema.messages,
      eq(schema.messages.caseId, schema.reliefCases.id)
    )
    .where(and(...filters))
    .groupBy(
      schema.reliefCases.id,
      schema.reliefCases.publicRef,
      schema.reliefCases.status,
      schema.reliefCases.chatMode,
      schema.reliefCases.createdAt,
      schema.reliefCases.updatedAt
    )
    .orderBy(desc(schema.reliefCases.updatedAt), desc(schema.reliefCases.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const items = pageRows.map((row) => ({
    caseId: row.caseId,
    publicRef: row.publicRef,
    status: row.status,
    chatMode: row.chatMode,
    createdAt: asDate(row.createdAt),
    lastActivityAt: asDate(row.lastActivityAt),
    messageCount: Number(row.messageCount),
  }));
  const last = items.at(-1);
  return {
    items,
    nextCursor:
      hasMore && last
        ? encodeHistoryCursor({
            lastActivityAt: last.lastActivityAt,
            caseId: last.caseId,
          })
        : null,
  };
}

/** Load only the reporter-visible transcript and safe case metadata. */
export async function loadReporterTranscript(
  workspace: ReporterWorkspaceContext,
  caseId: string,
  now = new Date()
): Promise<{
  caseId: string;
  publicRef: string;
  status: string;
  chatMode: string;
  messages: ReporterTranscriptMessage[];
} | null> {
  const row = await authorizeReporterCase(workspace, caseId, now);
  if (!row) return null;

  const db = getDb();
  const rows = await db.query.messages.findMany({
    where: eq(schema.messages.caseId, caseId),
    orderBy: [asc(schema.messages.createdAt), asc(schema.messages.id)],
    columns: {
      id: true,
      senderType: true,
      body: true,
      createdAt: true,
    },
  });

  return {
    caseId: row.id,
    publicRef: row.publicRef,
    status: row.status,
    chatMode: row.chatMode,
    messages: rows.map((message) => ({
      id: message.id,
      senderType: message.senderType,
      body: message.body,
      createdAt: asDate(message.createdAt),
    })),
  };
}
