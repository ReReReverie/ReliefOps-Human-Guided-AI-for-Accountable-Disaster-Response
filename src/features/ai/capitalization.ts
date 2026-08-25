/**
 * src/features/ai/capitalization.ts — Deterministic MessageStyleSignals from raw text.
 *
 * Rules from chatbot-spec §4:
 *   - Count English alphabetic characters only (a–z, A–Z).
 *   - uppercaseLetterRatio = uppercase / all alphabetic, rounded to 2 decimal places.
 *   - NONE  : < 4 alphabetic chars, OR < 4 uppercase letters, OR ratio < 0.25
 *   - SOME  : ≥ 4 uppercase letters AND ratio ∈ [0.25, 0.75)
 *   - STRONG: ≥ 4 uppercase letters AND ratio ≥ 0.75
 *
 * This is a pure function — no side effects, no I/O.
 */
import type { MessageStyleSignals } from "./provider";

/**
 * Compute MessageStyleSignals from a raw reporter message body.
 * The input is never modified; this operates on the unaltered transcript.
 */
export function computeMessageStyle(rawMessage: string): MessageStyleSignals {
  // Count alphabetic characters only (a-z, A-Z)
  let totalAlpha = 0;
  let totalUpper = 0;

  for (const ch of rawMessage) {
    const code = ch.charCodeAt(0);
    const isLower = code >= 97 && code <= 122; // a-z
    const isUpper = code >= 65 && code <= 90; // A-Z
    if (isLower || isUpper) {
      totalAlpha++;
      if (isUpper) {
        totalUpper++;
      }
    }
  }

  // Compute ratio; 0 when no alphabetic characters
  const ratio = totalAlpha === 0 ? 0 : totalUpper / totalAlpha;

  // Round to 2 decimal places
  const uppercaseLetterRatio = Math.round(ratio * 100) / 100;

  // Classify emphasis
  let uppercaseEmphasis: "NONE" | "SOME" | "STRONG";

  if (totalAlpha < 4 || totalUpper < 4 || ratio < 0.25) {
    uppercaseEmphasis = "NONE";
  } else if (ratio >= 0.75) {
    uppercaseEmphasis = "STRONG";
  } else {
    uppercaseEmphasis = "SOME";
  }

  return { uppercaseLetterRatio, uppercaseEmphasis };
}
