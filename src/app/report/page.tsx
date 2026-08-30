"use client";

/**
 * src/app/report/page.tsx — Reporter chat interface.
 *
 * Requirements (plan §9, chatbot-spec §2):
 *   - Displays synthetic-data and not-an-emergency-service warning.
 *   - Shows "Simulated AI Preview" label when mock provider is active.
 *   - Shows public case reference after first message.
 *   - Labels AI messages vs human coordinator messages.
 *   - Displays "Request a Human" when AI controls the chat.
 *   - Shows "A human coordinator is handling this conversation" when in HUMAN mode.
 *   - Plain text only — never renders AI-provided HTML or Markdown.
 *   - Accessible: labels, keyboard navigation, focus management.
 *
 * UI style: Telegram-inspired dark chat shell.
 */

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  FormEvent,
  KeyboardEvent,
} from "react";
import { ReporterHistory } from "@/components/reporter/ReporterHistory";
import { useReporterWorkspace } from "@/features/reporter/useReporterWorkspace";
import type { ReporterMessage } from "@/features/reporter/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MessageItem = ReporterMessage;

type ChatState =
  | { phase: "idle" }
  | { phase: "loading" }
  | {
      phase: "active";
      caseId: string;
      publicRef: string;
      status: string;
      chatMode: string;
      aiProvider: string;
      messages: MessageItem[];
    }
  | {
      phase: "human_mode";
      caseId: string;
      publicRef: string;
      status: string;
      chatMode: string;
      aiProvider: string;
      messages: MessageItem[];
    }
  | { phase: "error"; message: string };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ReportPage() {
  const [inputValue, setInputValue] = useState("");
  const [state, setState] = useState<ChatState>({ phase: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const [humanRequestError, setHumanRequestError] = useState<string | null>(
    null
  );
  const [historyOpen, setHistoryOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const chatRequestIdRef = useRef(0);
  const workspace = useReporterWorkspace();
  const openHistory = useCallback(() => setHistoryOpen(true), []);
  const closeHistory = useCallback(() => setHistoryOpen(false), []);

  // Hydrate the unchanged Telegram message renderer when an authorized
  // history item is selected. The workspace hook aborts stale selections.
  useEffect(() => {
    const transcript = workspace.transcript;
    if (!transcript || transcript.caseId !== workspace.selectedCaseId) return;

    setState({
      phase: "active",
      caseId: transcript.caseId,
      publicRef: transcript.publicRef,
      status: transcript.status,
      chatMode: transcript.chatMode,
      aiProvider: transcript.aiProvider,
      messages: transcript.messages,
    });
    setHumanRequestError(null);
    setInputValue("");
  }, [workspace.selectedCaseId, workspace.transcript]);

  useEffect(() => {
    if (!workspace.transcriptError || !workspace.selectedCaseId) return;
    setState({ phase: "error", message: workspace.transcriptError });
  }, [workspace.selectedCaseId, workspace.transcriptError]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state]);

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 120) + "px";
  }, [inputValue]);

  async function submitMessage(e: FormEvent) {
    e.preventDefault();
    const body = inputValue.trim();
    if (!body || submitting) return;

    // Keep a selected case attached to retries after a chat or transcript
    // error. The error state intentionally has no message payload, but the
    // workspace selection is still an explicit authorization context.
    const continuationCaseId =
      (state.phase === "active" || state.phase === "human_mode"
        ? state.caseId
        : workspace.selectedCaseId);

    const requestId = chatRequestIdRef.current + 1;
    chatRequestIdRef.current = requestId;
    setSubmitting(true);
    setHumanRequestError(null);
    setState((prev) =>
      prev.phase === "active" || prev.phase === "human_mode"
        ? prev
        : { phase: "loading" }
    );

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // `null` asks the workspace-aware API to create a new case. Older
        // deployments strip the optional property and continue legacy flow.
        body: JSON.stringify({
          body,
          caseId: continuationCaseId,
        }),
      });

      if (requestId !== chatRequestIdRef.current) return;

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setState({
          phase: "error",
          message:
            (err as { error?: string }).error ||
            "An error occurred. Please try again.",
        });
        return;
      }

      const data = await res.json();
      setInputValue("");

      // Handle human mode response
      if ((data as { awaitingHuman?: boolean }).awaitingHuman === true) {
        setState((prev) => ({
          phase: "human_mode",
          caseId:
            prev.phase === "active" || prev.phase === "human_mode"
              ? prev.caseId
              : String(data.caseId ?? ""),
          messages:
            prev.phase === "active" || prev.phase === "human_mode"
              ? prev.messages
              : [],
          publicRef:
            prev.phase === "active" || prev.phase === "human_mode"
              ? prev.publicRef
              : String(data.publicRef ?? ""),
          status:
            prev.phase === "active" || prev.phase === "human_mode"
              ? prev.status
              : String(data.status ?? "INTAKE"),
          chatMode: "HUMAN",
          aiProvider:
            prev.phase === "active" || prev.phase === "human_mode"
              ? prev.aiProvider
              : String(data.aiProvider ?? "ollama"),
        }));
        if (typeof data.caseId === "string") workspace.activateCase(data.caseId);
        refreshReporterHistory();
        return;
      }

      setState({
        phase: "active",
        caseId: String(data.caseId ?? ""),
        publicRef: String(data.publicRef ?? ""),
        status: String(data.status ?? "INTAKE"),
        chatMode: String(data.chatMode ?? "AI"),
        aiProvider: String(data.aiProvider ?? "ollama"),
        messages: data.messages ?? [],
      });
      if (typeof data.caseId === "string") workspace.activateCase(data.caseId);
      refreshReporterHistory();
    } catch {
      if (requestId !== chatRequestIdRef.current) return;
      setState({
        phase: "error",
        message: "Network error. Please check your connection and try again.",
      });
    } finally {
      if (requestId === chatRequestIdRef.current) setSubmitting(false);
    }
  }

  async function requestHuman() {
    if (state.phase !== "active") return;
    const requestId = chatRequestIdRef.current + 1;
    chatRequestIdRef.current = requestId;
    setSubmitting(true);
    setHumanRequestError(null);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: "I would like to speak with a human coordinator please.",
          caseId: state.caseId,
        }),
      });
      if (requestId !== chatRequestIdRef.current) return;
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setHumanRequestError(
          (err as { error?: string }).error ||
            "The human coordinator could not be requested. Please try again."
        );
        return;
      }

      const data = await res.json();
      setState((previous) => {
        if (previous.phase !== "active" && previous.phase !== "human_mode") {
          return previous;
        }
        return {
          phase: data.awaitingHuman === true ? "human_mode" : previous.phase,
          caseId: previous.caseId,
          publicRef: previous.publicRef,
          status: data.status ?? previous.status,
          chatMode:
            data.awaitingHuman === true
              ? "HUMAN"
              : data.chatMode ?? previous.chatMode,
          aiProvider: previous.aiProvider,
          messages: Array.isArray(data.messages)
            ? data.messages
            : previous.messages,
        };
      });
      if (
        typeof data.caseId === "string" &&
        data.caseId !== workspace.selectedCaseId
      ) {
        workspace.activateCase(data.caseId);
      }
      refreshReporterHistory();
    } catch {
      if (requestId !== chatRequestIdRef.current) return;
      setHumanRequestError(
        "Network error while requesting a human coordinator. Please try again."
      );
    } finally {
      if (requestId === chatRequestIdRef.current) setSubmitting(false);
    }
  }

  // Ctrl/Cmd+Enter to send, plain Enter inserts newline
  function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (inputValue.trim() && !submitting) {
        submitMessage(e as unknown as FormEvent);
      }
    }
  }

  function confirmDraftDiscard(): boolean {
    if (!inputValue.trim()) return true;
    return window.confirm("Discard your unsent draft?");
  }

  function handleSelectConversation(caseId: string) {
    if (
      caseId === workspace.selectedCaseId &&
      workspace.transcript &&
      !workspace.transcriptError &&
      !workspace.transcriptLoading
    ) {
      setHistoryOpen(false);
      return;
    }
    if (!confirmDraftDiscard()) return;
    chatRequestIdRef.current += 1;
    setSubmitting(false);
    setHumanRequestError(null);
    setInputValue("");
    setState({ phase: "loading" });
    void workspace.selectConversation(caseId);
    setHistoryOpen(false);
  }

  function handleNewChat(): boolean {
    if (!confirmDraftDiscard()) return false;
    chatRequestIdRef.current += 1;
    setSubmitting(false);
    setHumanRequestError(null);
    setInputValue("");
    workspace.clearSelection();
    setState({ phase: "idle" });
    setHistoryOpen(false);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
    return true;
  }

  function refreshReporterHistory() {
    if (workspace.status === "ready") {
      void workspace.refreshHistory();
    } else if (workspace.status === "initializing") {
      // The hook queues this refresh so a first message completed during
      // workspace initialization is included in the initial history page.
      void workspace.refreshHistory();
    } else if (
      workspace.status === "unavailable" ||
      workspace.status === "expired"
    ) {
      // A new first message can establish a fresh workspace after an expired
      // browser session. Do not interrupt an initialization already in flight.
      void workspace.initialize();
    }
  }

  const isMock = state.phase === "active" && state.aiProvider === "mock";

  const messages =
    state.phase === "active"
      ? state.messages
      : state.phase === "human_mode"
      ? state.messages
      : [];

  const chatMode =
    state.phase === "active" || state.phase === "human_mode"
      ? state.chatMode
      : "AI";

  const publicRef =
    state.phase === "active"
      ? state.publicRef
      : state.phase === "human_mode"
      ? state.publicRef
      : null;

  const isActive = state.phase === "active" || state.phase === "human_mode";

  return (
    /*
     * Full-height dark shell — mirrors Telegram's layout:
     *   chat header  (top bar with title + meta)
     *   scrollable message feed
     *   input bar (bottom)
     *
     * Uses 100dvh minus the site header height so the nav stays visible.
     * The outer <main> in layout.tsx must stretch to fill the remaining
     * viewport; we achieve this with the inline style on this element.
     */
    <div
      className="relative flex min-h-0 w-full"
      style={{
        background: "#17212b",
        height: "calc(100dvh - var(--site-header-h, 0px))",
      }}
    >
      <ReporterHistory
        status={workspace.status}
        expiresAt={workspace.expiresAt}
        items={workspace.history}
        nextCursor={workspace.nextCursor}
        loading={workspace.historyLoading}
        error={workspace.historyError}
        selectedCaseId={workspace.selectedCaseId}
        transcriptLoading={workspace.transcriptLoading}
        transcriptError={workspace.transcriptError}
        mobileOpen={historyOpen}
        onOpenMobile={openHistory}
        onCloseMobile={closeHistory}
        onSelect={handleSelectConversation}
        onNewChat={handleNewChat}
        onRefresh={() =>
          void (workspace.status === "ready"
            ? workspace.refreshHistory()
            : workspace.initialize())
        }
        onLoadMore={() => void workspace.loadMoreHistory()}
      />

      <div className="min-h-0 min-w-0 flex-1">
        <div
          style={{
            background: "#17212b",
            fontFamily: "'Segoe UI', system-ui, sans-serif",
            height: "calc(100dvh - var(--site-header-h, 0px))",
          }}
          className="flex flex-col"
        >
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header
        style={{ background: "#232e3c", borderBottom: "1px solid #1a2535" }}
        className="flex-none flex items-center gap-3 px-4 py-3 z-10"
      >
        {/* Avatar */}
        <div
          style={{ background: "#2563eb", width: 40, height: 40 }}
          className="rounded-full flex-none flex items-center justify-center text-white font-bold text-base select-none"
          aria-hidden="true"
        >
          RO
        </div>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <h1 className="font-semibold text-white text-sm leading-tight truncate">
            ReliefOps Incident Report
          </h1>
          <div style={{ color: "#8e9aac" }} className="text-xs leading-tight mt-0.5">
            {chatMode === "HUMAN"
              ? "Human coordinator connected"
              : isActive
              ? "AI assistant active"
              : "Start by describing the incident"}
          </div>
          {publicRef && (
            <p
              className="text-sm text-gray-500 truncate"
              style={{ color: "#8e9aac" }}
            >
              Case reference: {publicRef}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={openHistory}
          aria-expanded={historyOpen}
          aria-controls="reporter-history-drawer"
          className="min-h-11 flex-none rounded-md border px-2 py-1 text-xs font-semibold text-white transition-colors hover:bg-[#2b5278] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8ec7f4] lg:hidden"
          style={{ background: "#1b3145", borderColor: "#355777" }}
        >
          History
        </button>

        {/* Case ref pill */}
        {publicRef && (
          <span
            style={{ background: "#2b5278", color: "#8ec7f4" }}
            className="flex-none text-xs font-mono px-2 py-0.5 rounded-full"
          >
            {publicRef}
          </span>
        )}
      </header>

      {/* ── Warning banner (dismissible-feel, always visible) ───── */}
      <div
        role="alert"
        aria-live="polite"
        style={{ background: "#2a1f0d", borderBottom: "1px solid #4a3510", color: "#e0a94a" }}
        className="flex-none px-4 py-2 text-xs"
      >
        <strong>⚠ Prototype — synthetic data only.</strong>{" "}
        Not an emergency service. For real emergencies call your local number.
      </div>

      {/* Simulated AI banner */}
      {isMock && (
        <div
          style={{ background: "#0e2236", borderBottom: "1px solid #1a3a56", color: "#6aabde" }}
          className="flex-none px-4 py-2 text-xs"
        >
          <strong>Simulated AI Preview</strong> — responses are pre-generated fixtures.
        </div>
      )}

      {/* ── Message feed ────────────────────────────────────────── */}
      <section
        aria-label="Conversation"
        className="flex-1 overflow-y-auto px-4 py-4 space-y-1"
        style={{ overscrollBehavior: "contain" }}
      >
        {/* Idle placeholder */}
        {state.phase === "idle" && (
          <div className="flex justify-center mt-8">
            <div
              style={{ background: "#232e3c", color: "#8e9aac" }}
              className="text-xs px-4 py-2 rounded-full"
            >
              Send your first message to open a case
            </div>
          </div>
        )}

        {/* Human-mode system notice */}
        {chatMode === "HUMAN" && (
          <div className="flex justify-center my-2">
            <div
              role="status"
              style={{ background: "#162d1f", color: "#4caf7d", border: "1px solid #1e4a30" }}
              className="text-xs px-4 py-2 rounded-full"
            >
              A human coordinator is now handling this conversation
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Initial loading (no messages yet) */}
        {state.phase === "loading" && (
          <div className="space-y-2 mt-1">
            {/* Sent bubble skeleton */}
            <div className="flex justify-end">
              <div
                style={{ background: "#2b5278" }}
                className="h-8 w-48 rounded-2xl rounded-tr-sm animate-pulse"
              />
            </div>
            {/* Incoming typing indicator */}
            <div className="flex justify-start items-end gap-2">
              <div
                style={{ background: "#3e88c7", color: "#fff", width: 28, height: 28 }}
                className="rounded-full flex-none flex items-center justify-center text-xs font-bold"
                aria-hidden="true"
              >
                AI
              </div>
              <TypingDots />
            </div>
          </div>
        )}

        {/* Subsequent send — typing dots */}
        {submitting && isActive && (
          <div className="flex justify-start items-end gap-2 mt-1">
            <div
              style={{ background: "#3e88c7", width: 28, height: 28 }}
              className="rounded-full flex-none flex items-center justify-center text-xs font-bold text-white"
              aria-hidden="true"
            >
              {chatMode === "HUMAN" ? "HC" : "AI"}
            </div>
            <TypingDots />
          </div>
        )}

        {/* Error */}
        {state.phase === "error" && (
          <div className="flex justify-center my-2">
            <div
              role="alert"
              style={{ background: "#2d1515", color: "#f07070", border: "1px solid #4d2020" }}
              className="text-xs px-4 py-2 rounded-full max-w-xs text-center"
            >
              {state.message}
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </section>

      {/* ── Input bar ───────────────────────────────────────────── */}
      <div
        style={{ background: "#232e3c", borderTop: "1px solid #1a2535" }}
        className="flex-none px-3 py-3"
      >
        {/* Request a Human — appears above input when in AI mode and active */}
        {state.phase === "active" && chatMode === "AI" && (
          <div className="mb-2 flex flex-col items-center gap-1">
            <button
              type="button"
              onClick={requestHuman}
              disabled={submitting}
              style={{ color: "#6aabde" }}
              className="text-xs underline-offset-2 hover:underline disabled:opacity-50"
            >
              Request a human coordinator
            </button>
            {humanRequestError && (
              <p
                role="alert"
                className="max-w-xs text-center text-xs"
                style={{ color: "#f7a0a0" }}
              >
                {humanRequestError}
              </p>
            )}
          </div>
        )}

        <form onSubmit={submitMessage} className="flex items-end gap-2">
          {/* Textarea */}
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              id="message-input"
              name="body"
              rows={1}
              maxLength={2000}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={submitting}
              placeholder={
                state.phase === "idle" || state.phase === "loading"
                  ? "Describe the incident…"
                  : "Message…"
              }
              aria-label="Message input"
              aria-required="true"
              style={{
                background: "#17212b",
                color: "#e8f1f9",
                border: "none",
                outline: "none",
                resize: "none",
                lineHeight: "1.5",
                fontSize: "14px",
                overflowY: "hidden",
              }}
              className="w-full rounded-xl px-4 py-2.5 placeholder:text-gray-500 disabled:opacity-50"
            />
          </div>

          {/* Send button — paper plane */}
          <button
            type="submit"
            disabled={submitting || !inputValue.trim()}
            aria-label="Send message"
            style={{
              background: inputValue.trim() && !submitting ? "#3e88c7" : "#2b3f55",
              width: 40,
              height: 40,
              flexShrink: 0,
              transition: "background 0.15s",
            }}
            className="rounded-full flex items-center justify-center disabled:cursor-not-allowed"
          >
            <PaperPlaneIcon />
          </button>
        </form>

        <p style={{ color: "#a7b5c9" }} className="text-xs mt-1.5 text-right pr-12">
          {inputValue.length > 0 ? `${inputValue.length}/2000` : "Ctrl+Enter to send"}
        </p>
      </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// MessageBubble
// ---------------------------------------------------------------------------

function MessageBubble({ message }: { message: MessageItem }) {
  const isReporter = message.senderType === "REPORTER";
  const isAI = message.senderType === "AI";

  let label: string;
  if (isReporter) label = "You";
  else if (isAI) label = "ReliefOps AI";
  else label = "Human Coordinator";

  // Format time if available
  let timeStr = "";
  if (message.createdAt) {
    try {
      const d = new Date(message.createdAt);
      timeStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      // ignore
    }
  }

  return (
    <article
      aria-label={`Message from ${label}`}
      className={`flex items-end gap-2 ${isReporter ? "flex-row-reverse" : "flex-row"} mb-1`}
    >
      {/* Avatar — only for incoming */}
      {!isReporter && (
        <div
          style={{
            background: isAI ? "#3e88c7" : "#4caf7d",
            width: 28,
            height: 28,
            flexShrink: 0,
          }}
          className="rounded-full flex items-center justify-center text-white text-xs font-bold self-end mb-0.5"
          aria-hidden="true"
        >
          {isAI ? "AI" : "HC"}
        </div>
      )}

      {/* Bubble */}
      <div
        style={{
          maxWidth: "75%",
          background: isReporter
            ? "#2b5278"                  // Telegram outgoing blue
            : isAI
            ? "#182533"                  // Telegram incoming dark
            : "#1a3326",                 // Coordinator green-dark
          color: isReporter
            ? "#e8f1f9"
            : isAI
            ? "#c8d8e8"
            : "#7de8b0",
          borderRadius: isReporter
            ? "18px 18px 4px 18px"
            : "18px 18px 18px 4px",
        }}
        className="px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words"
      >
        {/* Sender label for non-reporter */}
        {!isReporter && (
          <div
            style={{ color: isAI ? "#6aabde" : "#4caf7d", fontSize: 11 }}
            className="font-semibold mb-0.5"
          >
            {label}
          </div>
        )}

        {/* Plain text body — never render HTML */}
        {message.body}

        {/* Timestamp */}
        {timeStr && (
          <div
            style={{ color: isReporter ? "#8ab8d8" : "#4a5e72", fontSize: 10 }}
            className="text-right mt-1 select-none"
          >
            {timeStr}
          </div>
        )}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// Typing dots indicator
// ---------------------------------------------------------------------------

function TypingDots() {
  return (
    <div
      role="status"
      aria-label="Waiting for response"
      style={{
        background: "#182533",
        borderRadius: "18px 18px 18px 4px",
      }}
      className="flex items-center gap-1 px-4 py-3"
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#4a7a9b",
            display: "inline-block",
            animation: `tg-dot-bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
          }}
        />
      ))}
      <style>{`
        @keyframes tg-dot-bounce {
          0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Paper plane SVG icon
// ---------------------------------------------------------------------------

function PaperPlaneIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      style={{ color: "#e8f1f9", transform: "rotate(45deg)", marginLeft: 2 }}
    >
      <path
        d="M22 2L11 13"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M22 2L15 22L11 13L2 9L22 2Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
