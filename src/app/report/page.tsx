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
 */

import { useState, useRef, useEffect, FormEvent } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type MessageItem = {
  id: string;
  senderType: "REPORTER" | "AI" | "COORDINATOR";
  body: string;
  createdAt: string;
};

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
  | { phase: "human_mode"; messages: MessageItem[]; publicRef: string }
  | { phase: "error"; message: string };

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ReportPage() {
  const [inputValue, setInputValue] = useState("");
  const [state, setState] = useState<ChatState>({ phase: "idle" });
  const [submitting, setSubmitting] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state]);

  async function submitMessage(e: FormEvent) {
    e.preventDefault();
    const body = inputValue.trim();
    if (!body || submitting) return;

    setSubmitting(true);
    setState((prev) =>
      prev.phase === "idle" ? { phase: "loading" } : prev
    );

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });

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
      if (
        (data as { awaitingHuman?: boolean }).awaitingHuman === true
      ) {
        setState((prev) => ({
          phase: "human_mode",
          messages:
            prev.phase === "active" || prev.phase === "human_mode"
              ? (prev as { messages: MessageItem[] }).messages
              : [],
          publicRef:
            prev.phase === "active"
              ? (prev as { publicRef: string }).publicRef
              : "",
        }));
        return;
      }

      setState({
        phase: "active",
        caseId: data.caseId,
        publicRef: data.publicRef,
        status: data.status,
        chatMode: data.chatMode,
        aiProvider: data.aiProvider,
        messages: data.messages ?? [],
      });
    } catch {
      setState({
        phase: "error",
        message: "Network error. Please check your connection and try again.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function requestHuman() {
    setSubmitting(true);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: "I would like to speak with a human coordinator please.",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (state.phase === "active") {
          setState({
            ...state,
            status: data.status ?? state.status,
            chatMode: data.chatMode ?? state.chatMode,
            messages: data.messages ?? state.messages,
          });
        }
      }
    } catch {
      // Non-critical; ignore
    } finally {
      setSubmitting(false);
    }
  }

  const isMock =
    state.phase === "active" && state.aiProvider === "mock";

  const messages =
    state.phase === "active"
      ? state.messages
      : state.phase === "human_mode"
      ? state.messages
      : [];

  const chatMode =
    state.phase === "active" ? state.chatMode : "AI";

  const publicRef =
    state.phase === "active"
      ? state.publicRef
      : state.phase === "human_mode"
      ? state.publicRef
      : null;

  return (
    <main className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Page header */}
        <h1 className="text-2xl font-semibold text-gray-900 mb-2">
          Report an Incident
        </h1>

        {/* Synthetic data + not-an-emergency-service warning */}
        <div
          role="alert"
          aria-live="polite"
          className="border border-amber-400 bg-amber-50 rounded p-3 mb-4 text-sm text-amber-900"
        >
          <strong>⚠ This is a prototype using synthetic data only.</strong>{" "}
          Do not submit real personal information. This is not an emergency
          service. If you have a real emergency, call your local emergency
          number immediately.
        </div>

        {/* Simulated AI Preview label */}
        {isMock && (
          <div
            role="status"
            className="border border-blue-300 bg-blue-50 rounded p-2 mb-4 text-sm text-blue-800"
          >
            <strong>Simulated AI Preview</strong> — responses are
            pre-generated fixtures, not live AI output.
          </div>
        )}

        {/* Public case reference */}
        {publicRef && (
          <p className="text-sm text-gray-500 mb-4">
            Case reference:{" "}
            <span className="font-mono font-medium text-gray-700">
              {publicRef}
            </span>
          </p>
        )}

        {/* Human mode notice */}
        {chatMode === "HUMAN" && (
          <div
            role="status"
            className="border border-green-300 bg-green-50 rounded p-3 mb-4 text-sm text-green-900"
          >
            A human coordinator is handling this conversation. Your messages
            are saved and will be reviewed.
          </div>
        )}

        {/* Message list */}
        {messages.length > 0 && (
          <section
            aria-label="Conversation"
            className="border border-gray-200 rounded mb-4 overflow-y-auto"
            style={{ maxHeight: "400px" }}
          >
            <div className="p-4 space-y-3">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              <div ref={messagesEndRef} />
            </div>
          </section>
        )}

        {/* Loading state — initial load */}
        {state.phase === "loading" && (
          <p role="status" aria-live="polite" className="text-sm text-gray-500 mb-4">
            Sending…
          </p>
        )}

        {/* Loading state — subsequent message while in active/human_mode phase */}
        {submitting && (state.phase === "active" || state.phase === "human_mode") && (
          <p role="status" aria-live="polite" className="text-sm text-gray-500 mb-2">
            Sending…
          </p>
        )}

        {/* Error state */}
        {state.phase === "error" && (
          <div
            role="alert"
            className="border border-red-300 bg-red-50 rounded p-3 mb-4 text-sm text-red-800"
          >
            {state.message}
          </div>
        )}

        {/* Message input form */}
        <form onSubmit={submitMessage} className="space-y-3">
          <div>
            <label
              htmlFor="message-input"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              {state.phase === "idle" || state.phase === "loading"
                ? "Describe the situation"
                : "Your message"}
            </label>
            <textarea
              id="message-input"
              name="body"
              rows={3}
              maxLength={2000}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={submitting}
              placeholder={
                state.phase === "idle" || state.phase === "loading"
                  ? "Describe what happened, where you are (synthetic location), and whether anyone is in immediate danger…"
                  : "Type your message…"
              }
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-900 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              aria-required="true"
            />
            <p className="text-xs text-gray-400 mt-1 text-right">
              {inputValue.length}/2000
            </p>
          </div>

          <div className="flex gap-3 items-center">
            <button
              type="submit"
              disabled={submitting || !inputValue.trim()}
              className="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Sending…" : "Send"}
            </button>

            {/* Request a Human button — only in AI mode after first message */}
            {state.phase === "active" &&
              state.chatMode === "AI" && (
                <button
                  type="button"
                  onClick={requestHuman}
                  disabled={submitting}
                  className="border border-gray-300 text-gray-700 text-sm px-4 py-2 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-400 disabled:opacity-50"
                >
                  Request a Human
                </button>
              )}
          </div>
        </form>

        {/* Privacy notice */}
        <p className="mt-6 text-xs text-gray-400">
          Do not enter real names, phone numbers, government identifiers,
          medical records, or location coordinates. Use only synthetic or
          fictional details.
        </p>
      </div>
    </main>
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

  return (
    <article
      aria-label={`Message from ${label}`}
      className={`flex flex-col ${isReporter ? "items-end" : "items-start"}`}
    >
      <span className="text-xs text-gray-400 mb-1">{label}</span>
      <div
        className={`max-w-prose text-sm rounded px-3 py-2 whitespace-pre-wrap break-words ${
          isReporter
            ? "bg-blue-600 text-white"
            : isAI
            ? "bg-gray-100 text-gray-900 border border-gray-200"
            : "bg-green-100 text-green-900 border border-green-200"
        }`}
      >
        {/* Plain text only — never render HTML */}
        {message.body}
      </div>
    </article>
  );
}
