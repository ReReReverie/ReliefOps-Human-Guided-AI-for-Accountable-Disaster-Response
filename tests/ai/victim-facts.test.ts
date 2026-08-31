/**
 * Contract regressions for the optional, demo-only victim alias and synthetic
 * coarse location. These tests intentionally exercise the same strict output
 * schema used by the Ollama provider; they do not require a live model.
 */
import { describe, expect, it, vi } from "vitest";
import { computeMessageStyle } from "@/features/ai/capitalization";
import { OllamaAiProvider } from "@/features/ai/ollama";
import { IntakeAnalysisSchema } from "@/features/ai/provider";

const URGENT_REVIEW_MESSAGE =
  "Your report was saved and flagged for urgent human review. If it is safe, is the bleeding controlled?";
const EXPLICIT_ALIAS_MESSAGE =
  "For this synthetic demo, the fictional alias is River. We are at Simulation Block C.";
const RIVER_SYNTHETIC_MESSAGE =
  "The person needing help uses the fictional alias River and is trapped in Simulation Block C with four other people while floodwater rises.";

function makeAnalysis(
  factsPatch: Record<string, unknown>,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    assistantMessage: URGENT_REVIEW_MESSAGE,
    factsPatch,
    missingFields: [],
    readyForHumanReview: true,
    communicationSignals: {
      analysisNormalizationApplied: false,
      apparentSpellingIssueLevel: "NONE",
      uppercaseLetterRatio: 0,
      uppercaseEmphasis: "NONE",
      possibleDistress: "NOT_INDICATED",
      explanation: "No diagnostic conclusion is made from writing style.",
    },
    urgency: {
      suggestedLevel: "CRITICAL",
      confidence: 0.92,
      factors: [
        {
          name: "IMMEDIATE_DANGER",
          severity: "HIGH",
          explanation: "The report describes an active threat to life.",
        },
      ],
      missingInformation: [],
      rationale: "Immediate danger is reported.",
    },
    proposedTasks: [],
    ...overrides,
  };
}

function expectSchemaSuccess(value: unknown) {
  const result = IntakeAnalysisSchema.safeParse(value);
  expect(result.success, result.success ? undefined : result.error.message).toBe(
    true
  );
  if (!result.success) {
    throw new Error(result.error.message);
  }
  return result.data;
}

describe("optional demo-only victim alias and synthetic location", () => {
  it("accepts a bounded fictional alias together with a coarse synthetic location", () => {
    const analysis = expectSchemaSuccess(
      makeAnalysis({
        victimName: "River",
        locationDescription: "Simulation Block C",
        immediateDanger: true,
      })
    );

    expect(analysis.factsPatch).toMatchObject({
      victimName: "River",
      locationDescription: "Simulation Block C",
    });
  });

  it.each([
    ["an empty alias", ""],
    ["an overlong alias", "A".repeat(41)],
    ["an email address", "River@example.com"],
    ["a phone number", "+1 555 0100"],
    ["a URL", "https://example.test/victim"],
    ["a multiline value", "River\nBlock C"],
  ])("rejects %s instead of storing it as victimName", (_description, victimName) => {
    const result = IntakeAnalysisSchema.safeParse(
      makeAnalysis({
        victimName,
        locationDescription: "Simulation Block C",
      })
    );

    expect(result.success).toBe(false);
  });

  it.each([
    "14.5995, 120.9842",
    "N14.5995 E120.9842",
    "123 Main Street",
    "https://maps.example.test/?q=14.5995,120.9842",
  ])("rejects a precise or live location value: %s", (locationDescription) => {
    const result = IntakeAnalysisSchema.safeParse(
      makeAnalysis({ victimName: "River", locationDescription })
    );

    expect(result.success).toBe(false);
  });

  it("accepts ordinary road wording when it is part of a coarse synthetic label", () => {
    const analysis = expectSchemaSuccess(
      makeAnalysis({
        victimName: "River",
        locationDescription: "Demo Riverside Road District",
      })
    );

    expect(analysis.factsPatch.locationDescription).toBe(
      "Demo Riverside Road District"
    );
  });

  it.each([
    [
      "an optional alias",
      ["victimName"],
      "Your report was saved and flagged for urgent human review. If it is safe, what fictional alias should we use for the person?",
      /(?:real|full|legal)\s+name|phone|telephone|mobile|email|address|identity|id\b/i,
    ],
    [
      "a coarse location",
      ["locationDescription"],
      "Your report was saved and flagged for urgent human review. If it is safe, which simulation block are you in?",
      /gps|coordinate|latitude|longitude|street address|exact address|live location/i,
    ],
  ])(
    "keeps CRITICAL readiness while asking one focused question about %s",
    (_description, missingFields, assistantMessage, prohibitedQuestionPattern) => {
      const analysis = expectSchemaSuccess(
        makeAnalysis(
          { immediateDanger: true },
          {
            assistantMessage,
            missingFields,
          }
        )
      );

      expect(analysis.readyForHumanReview).toBe(true);
      expect(analysis.urgency?.suggestedLevel).toBe("CRITICAL");
      expect(analysis.assistantMessage).toMatch(/saved and flagged for urgent human review/i);
      expect(analysis.assistantMessage).not.toMatch(prohibitedQuestionPattern);
    }
  );

  it("does not re-ask for an alias or location already confirmed", () => {
    const analysis = expectSchemaSuccess(
      makeAnalysis({
        victimName: "River",
        locationDescription: "Simulation Block C",
        immediateDanger: true,
        injuriesOrMedicalNeeds: "Bleeding leg injury",
      })
    );

    expect(analysis.assistantMessage).not.toMatch(
      /(?:alias|fictional name|real name|full name|legal name|location|district|landmark|where are you|simulation block)/i
    );
    expect(analysis.assistantMessage).toMatch(/bleeding|injury|safe|exit/i);
  });

  it("keeps both optional facts available in the coordinator-facing structured data", () => {
    const analysis = expectSchemaSuccess(
      makeAnalysis({
        victimName: "River",
        locationDescription: "Simulation Block C",
      })
    );

    const coordinatorFacts = { ...analysis.factsPatch };
    expect(coordinatorFacts).toMatchObject({
      victimName: "River",
      locationDescription: "Simulation Block C",
    });
  });

  it("returns both facts through the provider path for synthetic input", async () => {
    const provider = new OllamaAiProvider();
    const modelOutput = makeAnalysis({
      victimName: "River",
      locationDescription: "Simulation Block C",
      immediateDanger: true,
    });
    const callOllama = vi.fn().mockResolvedValue(JSON.stringify(modelOutput));

    // @ts-expect-error accessing private method for deterministic transport mocking
    provider._callOllama = callOllama;

    const analysis = await provider.analyzeIntake({
      confirmedFacts: {},
      publicMessages: [{ role: "REPORTER", body: RIVER_SYNTHETIC_MESSAGE }],
      latestMessageStyle: computeMessageStyle(RIVER_SYNTHETIC_MESSAGE),
    });

    expect(callOllama).toHaveBeenCalledTimes(1);
    expect(analysis.factsPatch).toMatchObject({
      victimName: "River",
      locationDescription: "Simulation Block C",
    });
  });

  it("keeps original intake context in repair and recovers an explicit fictional alias", async () => {
    const provider = new OllamaAiProvider();
    const repairedPayload = makeAnalysis({
      locationDescription: "Simulation Block C",
      immediateDanger: true,
    });
    const callOllama = vi
      .fn()
      .mockResolvedValueOnce('{"assistantMessage":"truncated')
      .mockResolvedValueOnce(JSON.stringify(repairedPayload));

    // @ts-expect-error accessing private method for deterministic transport mocking
    provider._callOllama = callOllama;

    const analysis = await provider.analyzeIntake({
      confirmedFacts: {},
      publicMessages: [{ role: "REPORTER", body: EXPLICIT_ALIAS_MESSAGE }],
      latestMessageStyle: computeMessageStyle(EXPLICIT_ALIAS_MESSAGE),
    });

    expect(callOllama).toHaveBeenCalledTimes(2);
    const repairPrompt = callOllama.mock.calls[1]?.[0] as string;
    expect(repairPrompt).toContain("CONFIRMED_FACTS:");
    expect(repairPrompt).toContain("PUBLIC_MESSAGES:");
    expect(repairPrompt).toContain("LATEST_MESSAGE_STYLE:");
    expect(repairPrompt).toContain(EXPLICIT_ALIAS_MESSAGE);
    expect(repairPrompt).toContain("Simulation Block C");
    expect(analysis.factsPatch).toMatchObject({
      victimName: "River",
      locationDescription: "Simulation Block C",
    });
  });

  it.each([
    ["a generic real-name request", "My real name is River. We are at Simulation Block C."],
    ["a phone number", "My phone number is +1 555 0100. We are at Simulation Block C."],
    ["an email address", "My email is river@example.com. We are at Simulation Block C."],
    [
      "an email-like fictional alias",
      "The fictional alias is River@example.com. We are at Simulation Block C.",
    ],
    [
      "a multiline fictional alias",
      "The fictional alias is River\nBlock C. We are at Simulation Block C.",
    ],
    [
      "a digit-prefixed fictional alias",
      "The fictional alias is 123 River. We are at Simulation Block C.",
    ],
  ])("does not recover %s as victimName", async (_description, message) => {
    const provider = new OllamaAiProvider();
    const modelOutput = makeAnalysis({
      locationDescription: "Simulation Block C",
      immediateDanger: true,
    });
    const callOllama = vi.fn().mockResolvedValue(JSON.stringify(modelOutput));

    // @ts-expect-error accessing private method for deterministic transport mocking
    provider._callOllama = callOllama;

    const analysis = await provider.analyzeIntake({
      confirmedFacts: {},
      publicMessages: [{ role: "REPORTER", body: message }],
      latestMessageStyle: computeMessageStyle(message),
    });

    expect(callOllama).toHaveBeenCalledTimes(1);
    expect(analysis.factsPatch.victimName).toBeUndefined();
  });
});
