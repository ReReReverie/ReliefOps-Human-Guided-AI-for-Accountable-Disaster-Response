"use client";
/**
 * src/features/cases/CaseControls.tsx — Case-level controls.
 *
 * Close Case button with guard enforcement (error shown if guard fails).
 * Set Case Status button (REVIEW → ACTIVE).
 * Chat Audit button — opens accessible dialog with Stellar verification.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { AlertTriangle } from "lucide-react";
import { closeCase, setCaseStatus, type CaseStatus } from "./actions";
import { ChatAuditDialog } from "./ChatAuditDialog";
import { Alert, Button } from "@/components/ui";

type Props = {
  caseId: string;
  currentStatus: string;
  /** auditId of the CHAT_STARTED record — null when not yet created */
  auditId?: string | null;
  /** Current DB anchor status — used to label retry button */
  auditDbStatus?: string;
};

export function CaseControls({ caseId, currentStatus, auditId, auditDbStatus }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirmingClose, setConfirmingClose] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);

  function handleCloseCase() {
    setConfirmingClose(false);
    setError(null);
    startTransition(async () => {
      try {
        await closeCase(caseId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Close failed.");
      }
    });
  }

  useEffect(() => {
    if (confirmingClose) confirmRef.current?.focus();
  }, [confirmingClose]);

  function handleSetStatus(status: CaseStatus) {
    setError(null);
    startTransition(async () => {
      try {
        await setCaseStatus(caseId, status);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Status update failed.");
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {currentStatus === "REVIEW" && (
          <Button
            type="button"
            onClick={() => handleSetStatus("ACTIVE")}
            disabled={isPending}
            size="sm"
            variant="success"
          >
            Mark Active
          </Button>
        )}
        {currentStatus !== "CLOSED" && (
          <Button
            type="button"
            onClick={() => setConfirmingClose(true)}
            disabled={isPending}
            size="sm"
            variant="dark"
          >
            Close Case
          </Button>
        )}
        <ChatAuditDialog
          auditId={auditId ?? null}
          initialDbStatus={auditDbStatus ?? "PENDING"}
        />
      </div>
      {confirmingClose && (
        <div role="dialog" aria-modal="true" aria-labelledby="close-case-title" className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle aria-hidden="true" className="mt-0.5 shrink-0 text-amber-700" size={18} />
            <div className="min-w-0">
              <h2 id="close-case-title" className="text-sm font-bold text-amber-950">Close this case?</h2>
              <p className="mt-1 text-xs leading-5 text-amber-900">Closing marks the workflow complete. Coordinator guards still apply, and this action cannot be undone from the demo.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button ref={confirmRef} type="button" size="sm" variant="danger" onClick={handleCloseCase} disabled={isPending}>{isPending ? "Closing…" : "Confirm Close Case"}</Button>
                <Button type="button" size="sm" variant="secondary" onClick={() => setConfirmingClose(false)} disabled={isPending}>Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}
      {error && <Alert tone="danger" role="alert">{error}</Alert>}
    </div>
  );
}
