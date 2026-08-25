/**
 * src/features/ai/index.ts — AI provider factory.
 *
 * Returns MockAiProvider when AI_PROVIDER=mock; otherwise OllamaAiProvider.
 * Configuration is read from environment via env helpers.
 *
 * Server-only — never import in browser code.
 */
import type { ReliefAiProvider } from "./provider";
import { OllamaAiProvider } from "./ollama";
import { MockAiProvider } from "./mock";

/**
 * Create the AI provider configured by the runtime environment.
 * Reads AI_PROVIDER, AI_BASE_URL, AI_MODEL, AI_MAX_OUTPUT_TOKENS, AI_CONTEXT_LENGTH.
 */
export function createAiProvider(): ReliefAiProvider {
  const providerName = process.env["AI_PROVIDER"] ?? "ollama";

  if (providerName === "mock") {
    return new MockAiProvider();
  }

  return new OllamaAiProvider({
    baseUrl: process.env["AI_BASE_URL"] ?? "http://127.0.0.1:11434/v1",
    model: process.env["AI_MODEL"] ?? "granite4.1:3b",
    maxTokens: Number(process.env["AI_MAX_OUTPUT_TOKENS"] ?? "600"),
    contextLength: Number(process.env["AI_CONTEXT_LENGTH"] ?? "4096"),
  });
}

// Re-export for convenience
export type { ReliefAiProvider } from "./provider";
export { OllamaAiProvider } from "./ollama";
export { MockAiProvider } from "./mock";
export { OllamaFailure } from "./ollama";
export { computeMessageStyle } from "./capitalization";
export { PROMPT_VERSION, MODEL_VERSION } from "./ollama";
