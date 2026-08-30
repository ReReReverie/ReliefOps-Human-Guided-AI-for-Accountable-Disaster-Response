"use client";
/**
 * src/features/cases/OverrideControl.tsx — One-click human override control.
 *
 * States:
 *   AI mode    → orange `!` button with aria-label and tooltip.
 *   Pending    → disabled with aria-busy.
 *   HUMAN mode → orange `! Human control` status badge.
 *   Failure    → retains AI mode and shows an inline accessible error.
 *
 * When `redirectOnOverride` is true (queue rows), a successful override
 * navigates to the case detail page so the coordinator can immediately chat.
 */
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { takeOverChat } from "./actions";
import { AlertTriangle } from "lucide-react";
import { Alert, Badge, Button } from "@/components/ui";

type Props = {
  caseId: string;
  chatMode: "AI" | "HUMAN";
  /** Whether the case is closed — closed cases cannot be overridden. */
  isClosed?: boolean;
  /**
   * When true, a successful override navigates to /ops/cases/[caseId]
   * so the coordinator can immediately access the chat. Use this on queue rows.
   */
  redirectOnOverride?: boolean;
};

export function OverrideControl({ caseId, chatMode, isClosed, redirectOnOverride }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  // HUMAN mode: show active badge
  if (chatMode === "HUMAN") {
    return (
      <Badge tone="success" icon={AlertTriangle} className="whitespace-nowrap" aria-label="Human control active">
        Human control
      </Badge>
    );
  }

  // Closed: no control
  if (isClosed) {
    return <span className="text-sm text-slate-500 select-none">Not available</span>;
  }

  function handleOverride() {
    setError(null);
    startTransition(async () => {
      try {
        await takeOverChat(caseId);
        if (redirectOnOverride) {
          router.push(`/ops/cases/${caseId}`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Override failed.");
      }
    });
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <Button
        type="button"
        onClick={handleOverride}
        disabled={isPending}
        aria-label="Override AI and take human control"
        aria-busy={isPending}
        title="Override AI and take human control"
        size="sm"
        variant="warning"
        className="min-h-11 min-w-11 px-2 text-base"
      >
        <AlertTriangle aria-hidden="true" size={17} />
        <span className="sr-only">Override</span>
      </Button>
      {error && (
        <Alert tone="danger" role="alert" className="max-w-[12rem] px-2 py-1 text-xs">{error}</Alert>
      )}
    </span>
  );
}
