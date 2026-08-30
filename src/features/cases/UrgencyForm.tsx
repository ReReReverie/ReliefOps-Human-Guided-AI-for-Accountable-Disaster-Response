"use client";
/**
 * src/features/cases/UrgencyForm.tsx — Human Final Urgency form.
 *
 * Labels:
 *   - AI urgency: "AI Suggested Urgency"
 *   - Human urgency: "Human Final Urgency"
 *
 * Rules (plan §9, spec §2):
 *   - Four radio buttons: CRITICAL / HIGH / MEDIUM / LOW
 *   - Required reason textarea
 *   - If selected level differs from AI suggestion, reason is required (already required always)
 *   - After submission, shows recorded human urgency.
 */
import { useTransition, useState } from "react";
import { setHumanUrgency, type UrgencyLevel } from "./actions";
import { Alert, Button, FieldLabel, StatusBadge } from "@/components/ui";

type Props = {
  caseId: string;
  aiSuggestedLevel: string | null;
  currentHumanUrgency: string | null;
};

const LEVELS: UrgencyLevel[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

export function UrgencyForm({ caseId, aiSuggestedLevel, currentHumanUrgency }: Props) {
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<UrgencyLevel | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function handleSubmit() {
    if (!selected) {
      setError("Please select an urgency level.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await setHumanUrgency(caseId, selected, reason.trim());
        setSubmitted(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Submission failed.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {aiSuggestedLevel && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-slate-600">AI Suggested Urgency</span>
          <StatusBadge status={aiSuggestedLevel} />
        </div>
      )}

      {currentHumanUrgency && !submitted ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-semibold text-slate-600">Human Final Urgency</span>
          <StatusBadge status={currentHumanUrgency} />
          <span className="text-xs text-slate-500">(recorded)</span>
        </div>
      ) : null}

      {submitted ? (
        <Alert tone="success"><span className="font-semibold">Human Final Urgency recorded:</span>{" "}<StatusBadge status={selected!} /></Alert>
      ) : (
        <div className="space-y-3">
          <div>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-slate-800">Select a final urgency level</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {LEVELS.map((level) => (
                <label key={level} className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-800 transition hover:border-blue-300 hover:bg-blue-50 motion-reduce:transition-none">
                  <input
                    type="radio"
                    name={`urgency-${caseId}`}
                    value={level}
                    checked={selected === level}
                    onChange={() => setSelected(level)}
                    className="h-4 w-4 accent-blue-700"
                  />
                  <StatusBadge status={level} />
                </label>
              ))}
            </div>
            </fieldset>
          </div>

          <div>
            <FieldLabel htmlFor={`reason-${caseId}`} optional>Reason</FieldLabel>
            <textarea
              id={`reason-${caseId}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="mt-2 min-h-24 w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              placeholder="Explain your urgency assessment…"
            />
          </div>

          {error && <Alert tone="danger" role="alert">{error}</Alert>}

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !selected}
            size="sm"
          >
            {isPending ? "Submitting…" : "Submit Urgency"}
          </Button>
        </div>
      )}
    </div>
  );
}
