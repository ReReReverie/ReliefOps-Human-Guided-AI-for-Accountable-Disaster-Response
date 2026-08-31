/**
 * Opt-in live regression coverage for the real Ollama/Granite provider.
 *
 * Normal test runs skip this file's tests and never require Ollama. To run them:
 *
 *   # PowerShell
 *   $env:RUN_LIVE_OLLAMA_TESTS = "1"
 *   pnpm test -- tests/ai/ollama.live.test.ts
 *
 * Set OLLAMA_TEST_BASE_URL when the test process runs in Docker, for example
 * http://host.docker.internal:11434/v1. The input is synthetic by design.
 */
import { describe, expect, it } from "vitest";
import { computeMessageStyle } from "@/features/ai/capitalization";
import { OllamaAiProvider } from "@/features/ai/ollama";
import { IntakeAnalysisSchema, type IntakeInput } from "@/features/ai/provider";

const LIVE_OLLAMA_ENABLED = process.env.RUN_LIVE_OLLAMA_TESTS === "1";
const SYNTHETIC_MESSAGE =
  "The person needing help uses the fictional alias River. I am trapped with four other people on the second floor of a house in Simulation Block C. The floodwater is rising quickly and has reached the stairs. One person has a bleeding leg injury, and an elderly adult is with us. The road outside is flooded and cannot be used.";
const STAGED_TURN_ONE =
  "River is trapped with four other people in Simulation Block C. Floodwater is rising quickly, one person has a bleeding leg injury, and an elderly adult is with us.";
const STAGED_TURN_TWO =
  "The bleeding is controlled and there is another safe exit. I am nearby but not at the house.";
const STAGED_TURN_THREE =
  "I use the fictional alias Scout. My relationship is NEARBY_WITNESS. My location is Demo Riverside Road District.";
const STAGED_TURN_FOUR = "The water is still rising.";

function positiveIntegerEnv(name: string, fallback: number): number {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function createLiveProvider(): OllamaAiProvider {
  return new OllamaAiProvider({
    baseUrl:
      process.env.OLLAMA_TEST_BASE_URL ??
      process.env.AI_BASE_URL ??
      "http://127.0.0.1:11434/v1",
    model: process.env.AI_MODEL ?? "granite4.1:3b",
    maxTokens: positiveIntegerEnv("AI_MAX_OUTPUT_TOKENS", 1200),
    contextLength: positiveIntegerEnv("AI_CONTEXT_LENGTH", 4096),
  });
}

function questionText(message: string): string {
  return message
    .split(/(?<=\?)\s+/)
    .filter((part) => part.includes("?"))
    .join(" ")
    .toLowerCase();
}

function expectUrgentReview(analysis: Awaited<ReturnType<OllamaAiProvider["analyzeIntake"]>>) {
  expect(IntakeAnalysisSchema.safeParse(analysis).success).toBe(true);
  expect(analysis.readyForHumanReview).toBe(true);
  expect(analysis.urgency?.suggestedLevel).toBe("CRITICAL");
  expect(analysis.assistantMessage).toMatch(
    /saved and flagged for urgent human review/i
  );
}

describe.skipIf(!LIVE_OLLAMA_ENABLED)("Live Ollama/Granite regression", () => {
  it(
    "returns a schema-valid CRITICAL review analysis for synthetic immediate-danger input",
    async () => {
      const latestMessageStyle = computeMessageStyle(SYNTHETIC_MESSAGE);
      const provider = createLiveProvider();

      const analysis = await provider.analyzeIntake({
        // The count is already confirmed. Alias and coarse location are in the
        // synthetic public report so the provider must extract both facts.
        confirmedFacts: {
          peopleAffected: 5,
          immediateDanger: true,
        },
        publicMessages: [{ role: "REPORTER", body: SYNTHETIC_MESSAGE }],
        latestMessageStyle,
      });

      const schemaResult = IntakeAnalysisSchema.safeParse(analysis);
      expect(schemaResult.success).toBe(true);
      expect(analysis.communicationSignals.uppercaseLetterRatio).toBe(
        latestMessageStyle.uppercaseLetterRatio
      );
      expect(analysis.communicationSignals.uppercaseEmphasis).toBe(
        latestMessageStyle.uppercaseEmphasis
      );
      expect(analysis.readyForHumanReview).toBe(true);
      expect(analysis.urgency?.suggestedLevel).toBe("CRITICAL");
      expect(analysis.factsPatch.victimName).toBe("River");
      expect(analysis.factsPatch.locationDescription).toBe("Simulation Block C");

      const assistantMessage = analysis.assistantMessage.toLowerCase();
      expect(assistantMessage).toMatch(/\b(?:saved|flagged)\b/);
      expect(assistantMessage).toMatch(
        /\b(?:urgent|immediate)\b[\s\S]{0,80}\bhuman review\b/
      );
      expect(assistantMessage).not.toMatch(
        /\b(?:what(?:\s+is|'s)?|provide|share|send|give|tell me|confirm|may i have)\b[^?.!]{0,80}\b(?:real|full|legal)?\s*name\b/
      );
      expect(assistantMessage).not.toMatch(
        /\b(?:what(?:\s+is|'s)?|provide|share|send|give|tell me|confirm|may i have)\b[^?.!]{0,80}\b(?:phone|telephone|mobile)(?:\s+number)?\b/
      );
      expect(assistantMessage).not.toMatch(
        /\b(?:help|assistance|responders?|emergency services?|support)\b[\s\S]{0,80}\b(?:on the way|dispatched|sent|assigned|arriving)\b|\b(?:on the way|dispatched|sent|assigned|arriving)\b[\s\S]{0,80}\b(?:help|assistance|responders?|emergency services?|support)\b/
      );

      const questions = assistantMessage
        .split(/(?<=\?)\s+/)
        .filter((part) => part.includes("?"))
        .join(" ");
      expect(questions).not.toMatch(/location|district|landmark|where/);
      expect(questions).not.toMatch(
        /how many|number of people|people affected|count/
      );
      if (analysis.missingFields.length > 0) {
        expect(questions).toContain("?");
        expect(questions).toMatch(
          /location|district|landmark|where|how many|number of people|people affected|injur|bleed|medical|safe|exit|route|road|access|water|food|shelter|elderly|child|vulnerab|need/
        );
      }
    },
    300_000
  );

  it(
    "keeps CRITICAL readiness while staging safety questions before reporter chatter",
    async () => {
      const provider = createLiveProvider();
      const turnOneMessages: IntakeInput["publicMessages"] = [
        { role: "REPORTER", body: STAGED_TURN_ONE },
      ];
      const turnOne = await provider.analyzeIntake({
        confirmedFacts: {},
        publicMessages: turnOneMessages,
        latestMessageStyle: computeMessageStyle(STAGED_TURN_ONE),
      });
      expectUrgentReview(turnOne);
      const turnOneQuestions = questionText(turnOne.assistantMessage);
      expect(turnOneQuestions).toMatch(/bleed|safe|exit|water|injur/);
      expect(turnOneQuestions).not.toMatch(
        /fictional\s+alias|reporter\s+alias|relationship\s+to\s+the\s+(?:victim|person)/
      );

      const turnTwoMessages: IntakeInput["publicMessages"] = [
        ...turnOneMessages,
        { role: "AI", body: turnOne.assistantMessage },
        { role: "REPORTER", body: STAGED_TURN_TWO },
      ];
      const turnTwo = await provider.analyzeIntake({
        confirmedFacts: {
          ...turnOne.factsPatch,
          injuriesOrMedicalNeeds: "Bleeding is controlled",
          accessHazards: ["There is another safe exit"],
        },
        publicMessages: turnTwoMessages,
        latestMessageStyle: computeMessageStyle(STAGED_TURN_TWO),
      });
      expectUrgentReview(turnTwo);
      const turnTwoQuestions = questionText(turnTwo.assistantMessage);
      expect(turnTwoQuestions).toMatch(/fictional\s+alias|reporter\s+alias/);
      expect(turnTwoQuestions).toMatch(
        /relationship|self|nearby\s+witness|family|caregiver|other/
      );
      expect(turnTwoQuestions).not.toMatch(/phone|email|exact\s+address|gps|coordinate|live\s+location/);

      const turnThreeMessages: IntakeInput["publicMessages"] = [
        ...turnTwoMessages,
        { role: "AI", body: turnTwo.assistantMessage },
        { role: "REPORTER", body: STAGED_TURN_THREE },
      ];
      const turnThree = await provider.analyzeIntake({
        confirmedFacts: {
          ...turnTwo.factsPatch,
          locationDescription: "Simulation Block C",
        },
        publicMessages: turnThreeMessages,
        latestMessageStyle: computeMessageStyle(STAGED_TURN_THREE),
      });
      expectUrgentReview(turnThree);
      expect(turnThree.factsPatch).toMatchObject({
        reporterAlias: "Scout",
        reporterRelationship: "NEARBY_WITNESS",
        reporterLocationDescription: "Demo Riverside Road District",
      });
      expect(turnThree.factsPatch.locationDescription).not.toBe(
        "Demo Riverside Road District"
      );

      const turnFourMessages: IntakeInput["publicMessages"] = [
        ...turnThreeMessages,
        { role: "AI", body: turnThree.assistantMessage },
        { role: "REPORTER", body: STAGED_TURN_FOUR },
      ];
      const turnFour = await provider.analyzeIntake({
        confirmedFacts: {
          ...turnTwo.factsPatch,
          ...turnThree.factsPatch,
          locationDescription: "Simulation Block C",
        },
        publicMessages: turnFourMessages,
        latestMessageStyle: computeMessageStyle(STAGED_TURN_FOUR),
      });
      expectUrgentReview(turnFour);
      const turnFourQuestions = questionText(turnFour.assistantMessage);
      expect(turnFourQuestions).not.toMatch(
        /alias|relationship|reporter|where are you|location|district|landmark/
      );
    },
    300_000
  );
});
