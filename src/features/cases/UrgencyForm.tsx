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

type Props = {
  caseId: string;
  aiSuggestedLevel: string | null;
  currentHumanUrgency: string | null;
};

const LEVELS: UrgencyLevel[] = ["CRITICAL", "HIGH", "MEDIUM", "LOW"];

const LEVEL_COLOR: Record<string, string> = {
  CRITICAL: "text-red-700 font-semibold",
  HIGH: "text-orange-600 font-semibold",
  MEDIUM: "text-yellow-700 font-semibold",
  LOW: "text-gray-600 font-semibold",
};

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
    if (!reason.trim()) {
      setError("A reason is required.");
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
        <div className="text-sm">
          <span className="text-gray-600">AI Suggested Urgency: </span>
          <span className={LEVEL_COLOR[aiSuggestedLevel] ?? "font-semibold"}>
            {aiSuggestedLevel}
          </span>
        </div>
      )}

      {currentHumanUrgency && !submitted ? (
        <div className="text-sm">
          <span className="text-gray-600">Human Final Urgency: </span>
          <span className={LEVEL_COLOR[currentHumanUrgency] ?? "font-semibold"}>
            {currentHumanUrgency}
          </span>
          <span className="ml-2 text-gray-400">(recorded)</span>
        </div>
      ) : null}

      {submitted ? (
        <div className="text-sm text-green-700">
          Human Final Urgency recorded:{" "}
          <span className={LEVEL_COLOR[selected!] ?? "font-semibold"}>
            {selected}
          </span>
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-2">
              Human Final Urgency
            </p>
            <div className="flex gap-4 flex-wrap">
              {LEVELS.map((level) => (
                <label key={level} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name={`urgency-${caseId}`}
                    value={level}
                    checked={selected === level}
                    onChange={() => setSelected(level)}
                    className="accent-blue-600"
                  />
                  <span className={`text-sm ${LEVEL_COLOR[level] ?? ""}`}>
                    {level}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor={`reason-${caseId}`}
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Reason{selected && selected !== aiSuggestedLevel ? " (required — differs from AI)" : " (required)"}
            </label>
            <textarea
              id={`reason-${caseId}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 border border-gray-300 rounded text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Explain your urgency assessment…"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={isPending || !selected || !reason.trim()}
            className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? "Submitting…" : "Submit Urgency"}
          </button>
        </div>
      )}
    </div>
  );
}
