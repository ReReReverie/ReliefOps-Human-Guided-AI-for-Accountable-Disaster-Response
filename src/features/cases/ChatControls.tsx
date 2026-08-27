"use client";
/**
 * src/features/cases/ChatControls.tsx — Chat section client controls.
 *
 * Renders:
 *   - OverrideControl (orange `!` when chatMode = 'AI'; active badge when HUMAN)
 *   - Resume AI button (when chatMode = 'HUMAN')
 *   - Coordinator reply textarea + Send button (HUMAN mode only)
 *
 * Plan §9 / spec §3.
 */
import { useTransition, useState } from "react";
import { resumeAi, sendCoordinatorReply } from "./actions";
import { OverrideControl } from "./OverrideControl";

type Props = {
  caseId: string;
  chatMode: "AI" | "HUMAN";
  isClosed?: boolean;
};

export function ChatControls({ caseId, chatMode, isClosed }: Props) {
  const [isPending, startTransition] = useTransition();
  const [replyBody, setReplyBody] = useState("");
  const [replyError, setReplyError] = useState<string | null>(null);

  function handleResumeAi() {
    startTransition(async () => {
      await resumeAi(caseId);
    });
  }

  function handleSendReply() {
    if (!replyBody.trim()) return;
    setReplyError(null);
    startTransition(async () => {
      try {
        await sendCoordinatorReply(caseId, replyBody.trim());
        setReplyBody("");
      } catch (err) {
        setReplyError(err instanceof Error ? err.message : "Send failed.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        {/* Override control: orange ! button (AI) or active badge (HUMAN) */}
        <OverrideControl caseId={caseId} chatMode={chatMode} isClosed={isClosed} />

        {/* Resume AI button — only in HUMAN mode */}
        {chatMode === "HUMAN" && (
          <button
            onClick={handleResumeAi}
            disabled={isPending}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            Resume AI
          </button>
        )}

        <span className="text-sm text-gray-500">
          Chat mode:{" "}
          <span className={chatMode === "HUMAN" ? "font-semibold text-orange-700" : "font-semibold text-blue-700"}>
            {chatMode}
          </span>
        </span>
      </div>

      {chatMode === "HUMAN" && (
        <div className="space-y-2">
          <textarea
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Type a reply to the reporter…"
            className="w-full px-3 py-2 border border-gray-300 rounded text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {replyError && (
            <p className="text-sm text-red-600">{replyError}</p>
          )}
          <button
            onClick={handleSendReply}
            disabled={isPending || !replyBody.trim()}
            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            Send Reply
          </button>
          <span className="text-xs text-gray-400 ml-2">
            {replyBody.length}/2000
          </span>
        </div>
      )}
    </div>
  );
}
