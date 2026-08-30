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
import { Bot, UserRound } from "lucide-react";
import { resumeAi, sendCoordinatorReply } from "./actions";
import { OverrideControl } from "./OverrideControl";
import { Alert, Badge, Button, FieldLabel } from "@/components/ui";

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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Override control: orange ! button (AI) or active badge (HUMAN) */}
        <OverrideControl caseId={caseId} chatMode={chatMode} isClosed={isClosed} />

        {/* Resume AI button — only in HUMAN mode */}
        {chatMode === "HUMAN" && (
          <Button
            type="button"
            onClick={handleResumeAi}
            disabled={isPending}
            size="sm"
            variant="secondary"
          >
            Resume AI
          </Button>
        )}

        <Badge tone={chatMode === "HUMAN" ? "success" : "info"} icon={chatMode === "HUMAN" ? UserRound : Bot}>Chat mode: {chatMode}</Badge>
      </div>

      {chatMode === "HUMAN" && (
        <div className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/60 p-4">
          <FieldLabel htmlFor={`coordinator-reply-${caseId}`}>Coordinator reply</FieldLabel>
          <textarea
            id={`coordinator-reply-${caseId}`}
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            maxLength={2000}
            rows={3}
            placeholder="Type a reply to the reporter…"
            className="min-h-24 w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 shadow-sm focus:border-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          />
          {replyError && (
            <Alert tone="danger" role="alert">{replyError}</Alert>
          )}
          <Button
            type="button"
            onClick={handleSendReply}
            disabled={isPending || !replyBody.trim()}
            size="sm"
            variant="success"
          >
            Send Reply
          </Button>
          <span className="ml-2 text-xs text-slate-500">
            {replyBody.length}/2000
          </span>
        </div>
      )}
    </div>
  );
}
