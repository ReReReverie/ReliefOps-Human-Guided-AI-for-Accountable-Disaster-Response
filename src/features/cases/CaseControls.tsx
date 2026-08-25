"use client";
/**
 * src/features/cases/CaseControls.tsx — Case-level controls.
 *
 * Close Case button with guard enforcement (error shown if guard fails).
 * Set Case Status button (REVIEW → ACTIVE).
 */
import { useTransition, useState } from "react";
import { closeCase, setCaseStatus, type CaseStatus } from "./actions";

type Props = {
  caseId: string;
  currentStatus: string;
};

export function CaseControls({ caseId, currentStatus }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCloseCase() {
    setError(null);
    startTransition(async () => {
      try {
        await closeCase(caseId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Close failed.");
      }
    });
  }

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
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {currentStatus === "REVIEW" && (
          <button
            onClick={() => handleSetStatus("ACTIVE")}
            disabled={isPending}
            className="text-sm px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
          >
            Mark Active
          </button>
        )}
        {currentStatus !== "CLOSED" && (
          <button
            onClick={handleCloseCase}
            disabled={isPending}
            className="text-sm px-3 py-1.5 bg-gray-700 text-white rounded hover:bg-gray-800 disabled:opacity-50"
          >
            Close Case
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
