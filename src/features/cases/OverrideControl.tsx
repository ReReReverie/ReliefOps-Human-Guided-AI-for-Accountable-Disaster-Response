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
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-orange-100 text-orange-700 border border-orange-300"
        aria-label="Human control active"
      >
        <span aria-hidden="true">!</span>
        {" Human control"}
      </span>
    );
  }

  // Closed: no control
  if (isClosed) {
    return <span className="text-gray-400 text-sm select-none">—</span>;
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
      <button
        onClick={handleOverride}
        disabled={isPending}
        aria-label="Override AI and take human control"
        aria-busy={isPending}
        title="Override AI and take human control"
        className="w-7 h-7 flex items-center justify-center rounded font-bold text-base bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
      >
        !
      </button>
      {error && (
        <span role="alert" className="text-xs text-red-600 max-w-[12rem]">
          {error}
        </span>
      )}
    </span>
  );
}
