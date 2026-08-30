"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  ReporterHistoryItem,
  ReporterMessage,
  ReporterTranscript,
} from "./types";

export type ReporterWorkspaceStatus =
  | "initializing"
  | "ready"
  | "unavailable"
  | "expired";

type WorkspaceInitPayload = {
  expiresAt: string;
  currentCaseId: string | null;
};

type HistoryPayload = {
  items: ReporterHistoryItem[];
  nextCursor: string | null;
};

type FetchJsonResult = {
  response: Response;
  payload: unknown;
};

const HISTORY_LIMIT = 20;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function asMessage(value: unknown): ReporterMessage | null {
  if (!isRecord(value)) return null;

  const id = asString(value.id);
  const body = typeof value.body === "string" ? value.body : null;
  const createdAt = asString(value.createdAt);
  const senderType = value.senderType;

  if (
    !id ||
    body === null ||
    !createdAt ||
    (senderType !== "REPORTER" &&
      senderType !== "AI" &&
      senderType !== "COORDINATOR")
  ) {
    return null;
  }

  return { id, senderType, body, createdAt };
}

function asHistoryItem(value: unknown): ReporterHistoryItem | null {
  if (!isRecord(value)) return null;

  const caseId = asString(value.caseId);
  const publicRef = asString(value.publicRef);
  const status = asString(value.status);
  const chatMode = asString(value.chatMode);
  const createdAt = asString(value.createdAt);
  const lastActivityAt = asString(value.lastActivityAt);
  const rawCount = value.messageCount;

  if (
    !caseId ||
    !publicRef ||
    !status ||
    !chatMode ||
    !createdAt ||
    !lastActivityAt ||
    (typeof rawCount !== "number" || !Number.isFinite(rawCount) || rawCount < 0)
  ) {
    return null;
  }

  return {
    caseId,
    publicRef,
    status,
    chatMode,
    createdAt,
    lastActivityAt,
    messageCount: Math.floor(rawCount),
  };
}

function parseWorkspaceInit(payload: unknown): WorkspaceInitPayload | null {
  if (!isRecord(payload)) return null;

  const expiresAt = asString(payload.expiresAt);
  if (!expiresAt || Number.isNaN(Date.parse(expiresAt))) return null;

  const currentCaseId =
    asString(payload.currentCaseId) ?? asString(payload.caseId) ?? null;

  return { expiresAt, currentCaseId };
}

function parseHistory(payload: unknown): HistoryPayload | null {
  const root = Array.isArray(payload)
    ? { items: payload }
    : isRecord(payload)
    ? payload
    : null;
  if (!root) return null;

  const rawItems = Array.isArray(root.items)
    ? root.items
    : Array.isArray(root.history)
    ? root.history
    : Array.isArray(root.cases)
    ? root.cases
    : null;

  if (!rawItems) return null;

  const items = rawItems
    .map(asHistoryItem)
    .filter((item): item is ReporterHistoryItem => item !== null);

  const rawCursor = root.nextCursor;
  const nextCursor = typeof rawCursor === "string" && rawCursor ? rawCursor : null;

  return { items, nextCursor };
}

function parseTranscript(payload: unknown): ReporterTranscript | null {
  if (!isRecord(payload)) return null;

  const caseId = asString(payload.caseId);
  const publicRef = asString(payload.publicRef);
  const status = asString(payload.status);
  const chatMode = asString(payload.chatMode);
  const aiProvider = asString(payload.aiProvider) ?? "ollama";
  const rawMessages = Array.isArray(payload.messages) ? payload.messages : null;

  if (!caseId || !publicRef || !status || !chatMode || !rawMessages) return null;

  const messages = rawMessages
    .map(asMessage)
    .filter((message): message is ReporterMessage => message !== null);

  return { caseId, publicRef, status, chatMode, aiProvider, messages };
}

async function fetchJson(
  input: RequestInfo | URL,
  init: RequestInit,
  signal: AbortSignal
): Promise<FetchJsonResult> {
  const response = await fetch(input, {
    ...init,
    signal,
    credentials: "same-origin",
    cache: "no-store",
    headers: {
      Accept: "application/json",
      ...(init.headers ?? {}),
    },
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    // Some failure responses intentionally have no JSON body.
  }

  return { response, payload };
}

function isExpiredResponse(status: number): boolean {
  return status === 401 || status === 410;
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/**
 * Owns the browser tab's workspace selection and safe history hydration.
 *
 * The HttpOnly workspace cookie remains the only credential. This hook keeps
 * no token, transcript, or case data in browser storage.
 */
export function useReporterWorkspace() {
  const [status, setStatus] = useState<ReporterWorkspaceStatus>("initializing");
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [history, setHistory] = useState<ReporterHistoryItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<ReporterTranscript | null>(null);
  const [transcriptLoading, setTranscriptLoading] = useState(false);
  const [transcriptError, setTranscriptError] = useState<string | null>(null);

  const workspaceRequestRef = useRef<AbortController | null>(null);
  const historyRequestRef = useRef<AbortController | null>(null);
  const historyRequestIdRef = useRef(0);
  const transcriptRequestRef = useRef<AbortController | null>(null);
  const transcriptRequestIdRef = useRef(0);
  const pendingRefreshRef = useRef(false);

  const markExpired = useCallback(() => {
    workspaceRequestRef.current?.abort();
    historyRequestRef.current?.abort();
    transcriptRequestRef.current?.abort();
    historyRequestIdRef.current += 1;
    transcriptRequestIdRef.current += 1;
    setStatus("expired");
    setHistory([]);
    setNextCursor(null);
    setSelectedCaseId(null);
    setTranscript(null);
    setHistoryError(null);
    setTranscriptError(null);
    setHistoryLoading(false);
    setTranscriptLoading(false);
  }, []);

  const loadHistory = useCallback(
    async (
      cursor: string | null,
      append: boolean,
      signal: AbortSignal,
      requestId: number
    ) => {
      const query = new URLSearchParams({ limit: String(HISTORY_LIMIT) });
      if (cursor) query.set("cursor", cursor);

      const { response, payload } = await fetchJson(
        `/api/chat/history?${query.toString()}`,
        { method: "GET" },
        signal
      );

      // AbortController is respected by the browser fetch implementation, but
      // checking both the signal and a monotonically increasing request id
      // also protects against test doubles and late responses from a server
      // that completed just as a newer refresh started.
      if (signal.aborted || historyRequestIdRef.current !== requestId) return;

      if (isExpiredResponse(response.status)) {
        markExpired();
        return;
      }

      if (!response.ok) {
        throw new Error("History is temporarily unavailable.");
      }

      const parsed = parseHistory(payload);
      if (!parsed) throw new Error("History is temporarily unavailable.");

      setHistory((previous) => (append ? [...previous, ...parsed.items] : parsed.items));
      setNextCursor(parsed.nextCursor);
      setHistoryError(null);
    },
    [markExpired]
  );

  const refreshHistory = useCallback(async () => {
    if (status !== "ready") {
      pendingRefreshRef.current = true;
      return;
    }

    historyRequestRef.current?.abort();
    const controller = new AbortController();
    const requestId = historyRequestIdRef.current + 1;
    historyRequestIdRef.current = requestId;
    historyRequestRef.current = controller;
    setHistoryLoading(true);
    setHistoryError(null);

    try {
      await loadHistory(null, false, controller.signal, requestId);
    } catch (error) {
      if (
        isAbortError(error) ||
        controller.signal.aborted ||
        historyRequestIdRef.current !== requestId
      ) {
        return;
      }
      setHistoryError(
        error instanceof Error
          ? error.message
          : "History is temporarily unavailable."
      );
    } finally {
      if (
        !controller.signal.aborted &&
        historyRequestIdRef.current === requestId
      ) {
        setHistoryLoading(false);
      }
    }
  }, [loadHistory, status]);

  const loadMoreHistory = useCallback(async () => {
    if (status !== "ready" || !nextCursor || historyLoading) return;

    historyRequestRef.current?.abort();
    const controller = new AbortController();
    const requestId = historyRequestIdRef.current + 1;
    historyRequestIdRef.current = requestId;
    historyRequestRef.current = controller;
    setHistoryLoading(true);
    setHistoryError(null);

    try {
      await loadHistory(nextCursor, true, controller.signal, requestId);
    } catch (error) {
      if (
        isAbortError(error) ||
        controller.signal.aborted ||
        historyRequestIdRef.current !== requestId
      ) {
        return;
      }
      setHistoryError(
        error instanceof Error
          ? error.message
          : "History is temporarily unavailable."
      );
    } finally {
      if (
        !controller.signal.aborted &&
        historyRequestIdRef.current === requestId
      ) {
        setHistoryLoading(false);
      }
    }
  }, [historyLoading, loadHistory, nextCursor, status]);

  const selectConversation = useCallback(
    async (caseId: string) => {
      const normalizedCaseId = caseId.trim();
      if (!normalizedCaseId || normalizedCaseId.length > 128) {
        setTranscriptError("This conversation is unavailable.");
        return;
      }

      transcriptRequestRef.current?.abort();
      const controller = new AbortController();
      const requestId = transcriptRequestIdRef.current + 1;
      transcriptRequestIdRef.current = requestId;
      transcriptRequestRef.current = controller;

      setSelectedCaseId(normalizedCaseId);
      setTranscript(null);
      setTranscriptError(null);
      setTranscriptLoading(true);

      try {
        const { response, payload } = await fetchJson(
          `/api/cases/${encodeURIComponent(normalizedCaseId)}/chat`,
          { method: "GET" },
          controller.signal
        );

        if (
          controller.signal.aborted ||
          transcriptRequestIdRef.current !== requestId
        ) {
          return;
        }

        if (isExpiredResponse(response.status)) {
          markExpired();
          return;
        }

        if (!response.ok) {
          throw new Error("This conversation is unavailable.");
        }

        const parsed = parseTranscript(payload);
        if (!parsed) throw new Error("This conversation is unavailable.");

        setTranscript(parsed);
      } catch (error) {
        if (isAbortError(error)) return;
        if (transcriptRequestIdRef.current !== requestId) return;
        setTranscriptError(
          error instanceof Error
            ? error.message
            : "This conversation is unavailable."
        );
      } finally {
        if (
          !controller.signal.aborted &&
          transcriptRequestIdRef.current === requestId
        ) {
          setTranscriptLoading(false);
        }
      }
    },
    [markExpired]
  );

  const clearSelection = useCallback(() => {
    transcriptRequestRef.current?.abort();
    transcriptRequestIdRef.current += 1;
    setSelectedCaseId(null);
    setTranscript(null);
    setTranscriptError(null);
    setTranscriptLoading(false);
  }, []);

  /** Mark a newly-created case active without a duplicate transcript request. */
  const activateCase = useCallback((caseId: string) => {
    const normalizedCaseId = caseId.trim();
    if (!normalizedCaseId) return;
    transcriptRequestRef.current?.abort();
    transcriptRequestIdRef.current += 1;
    setSelectedCaseId(normalizedCaseId);
    setTranscript(null);
    setTranscriptError(null);
    setTranscriptLoading(false);
  }, []);

  const initialize = useCallback(async () => {
    workspaceRequestRef.current?.abort();
    historyRequestRef.current?.abort();
    historyRequestIdRef.current += 1;
    const controller = new AbortController();
    workspaceRequestRef.current = controller;
    const initialSelectionRequestId = transcriptRequestIdRef.current;
    setStatus("initializing");
    setHistoryError(null);

    try {
      const { response, payload } = await fetchJson(
        "/api/chat/workspace",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
        controller.signal
      );

      if (
        controller.signal.aborted ||
        workspaceRequestRef.current !== controller
      ) {
        return;
      }

      if (isExpiredResponse(response.status)) {
        markExpired();
        return;
      }

      if (!response.ok) {
        throw new Error("History is unavailable in this browser session.");
      }

      const parsed = parseWorkspaceInit(payload);
      if (!parsed) {
        throw new Error("History is unavailable in this browser session.");
      }

      if (Date.parse(parsed.expiresAt) <= Date.now()) {
        markExpired();
        return;
      }

      setExpiresAt(parsed.expiresAt);
      setStatus("ready");

      // Use the same request controller for the initial history load so a
      // remount or retry cannot leave an older result in the rail.
      const historyRequestId = historyRequestIdRef.current + 1;
      historyRequestIdRef.current = historyRequestId;
      setHistoryLoading(true);
      try {
        await loadHistory(null, false, controller.signal, historyRequestId);
      } catch (error) {
        if (
          isAbortError(error) ||
          controller.signal.aborted ||
          historyRequestIdRef.current !== historyRequestId
        ) {
          return;
        }
        setHistoryError(
          error instanceof Error
            ? error.message
            : "History is temporarily unavailable."
        );
      } finally {
        if (
          !controller.signal.aborted &&
          historyRequestIdRef.current === historyRequestId
        ) {
          setHistoryLoading(false);
        }
      }

      if (
        controller.signal.aborted ||
        workspaceRequestRef.current !== controller
      ) {
        return;
      }

      // A message can finish while workspace initialization is still loading
      // the first page. Replay that refresh after the initial request so a
      // newly-created case cannot miss the history rail.
      if (pendingRefreshRef.current && !controller.signal.aborted) {
        pendingRefreshRef.current = false;
        historyRequestRef.current?.abort();
        const refreshController = new AbortController();
        const refreshRequestId = historyRequestIdRef.current + 1;
        historyRequestIdRef.current = refreshRequestId;
        historyRequestRef.current = refreshController;
        setHistoryLoading(true);
        try {
          await loadHistory(
            null,
            false,
            refreshController.signal,
            refreshRequestId
          );
        } catch (error) {
          if (
            !isAbortError(error) &&
            !refreshController.signal.aborted &&
            historyRequestIdRef.current === refreshRequestId
          ) {
            setHistoryError(
              error instanceof Error
                ? error.message
                : "History is temporarily unavailable."
            );
          }
        } finally {
          if (
            !refreshController.signal.aborted &&
            historyRequestIdRef.current === refreshRequestId
          ) {
            setHistoryLoading(false);
          }
        }
      }

      if (
        controller.signal.aborted ||
        workspaceRequestRef.current !== controller ||
        transcriptRequestIdRef.current !== initialSelectionRequestId ||
        !parsed.currentCaseId
      ) {
        return;
      }
      await selectConversation(parsed.currentCaseId);
    } catch (error) {
      if (
        isAbortError(error) ||
        controller.signal.aborted ||
        workspaceRequestRef.current !== controller
      ) {
        return;
      }
      setStatus("unavailable");
      setHistory([]);
      setNextCursor(null);
      setHistoryError(
        error instanceof Error
          ? error.message
          : "History is unavailable in this browser session."
      );
    }
  }, [loadHistory, markExpired, selectConversation]);

  useEffect(() => {
    void initialize();

    return () => {
      workspaceRequestRef.current?.abort();
      historyRequestRef.current?.abort();
      transcriptRequestRef.current?.abort();
    };
  }, [initialize]);

  useEffect(() => {
    if (!expiresAt) return;
    const remaining = Date.parse(expiresAt) - Date.now();
    if (remaining <= 0) {
      markExpired();
      return;
    }

    const timer = window.setTimeout(markExpired, remaining);
    return () => window.clearTimeout(timer);
  }, [expiresAt, markExpired]);

  useEffect(() => {
    function handleFocus() {
      void refreshHistory();
    }

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, [refreshHistory]);

  return {
    status,
    expiresAt,
    history,
    nextCursor,
    historyLoading,
    historyError,
    selectedCaseId,
    transcript,
    transcriptLoading,
    transcriptError,
    initialize,
    refreshHistory,
    loadMoreHistory,
    selectConversation,
    clearSelection,
    activateCase,
  };
}
