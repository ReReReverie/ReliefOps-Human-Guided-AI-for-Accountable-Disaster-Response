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
  "I use the fictional alias Scout. I am a nearby witness. My location is Demo Riverside Road District.";
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

function normalizedQuestionText(message: string): string {
  return questionText(message).replace(/\s+/g, " ").trim();
}

function expectNoRepeatedQuestion(message: string, previousMessage: string): void {
  const currentQuestion = normalizedQuestionText(message);
  const previousQuestion = normalizedQuestionText(previousMessage);
  // A completed caller-details turn is intentionally allowed to contain no
  // question. Comparing two empty extracts would report a false repeat.
  if (!currentQuestion || !previousQuestion) return;
  expect(currentQuestion).not.toBe(previousQuestion);
}

function expectNoSensitiveReporterRequest(message: string): void {
  const normalized = message.toLowerCase();
  expect(normalized).not.toMatch(
    /\b(?:real|full|legal)\s+name\b|\b(?:phone|telephone|mobile)(?:\s+number)?\b|\bemail(?:\s+address)?\b|\bcontact\s+(?:method|details|information)\b/
  );
  expect(normalized).not.toMatch(
    /\b(?:street|exact)\s+address\b|\b(?:gps|latitude|longitude|coordinates?)\b|\blive\s+location\b/
  );
}

function expectNoDispatchPromise(message: string): void {
  expect(message.toLowerCase()).not.toMatch(
    /\b(?:responders?|help|assistance|ambulance|police|firefighters?|emergency services?|support)\b[\s\S]{0,80}\b(?:on the way|dispatched|sent|assigned|coordinated|arriving|will arrive)\b|\b(?:on the way|dispatched|sent|assigned|coordinated|arriving|will arrive)\b[\s\S]{0,80}\b(?:responders?|help|assistance|ambulance|police|firefighters?|emergency services?|support)\b|\b(?:report|case|incident|situation)\b.{0,80}\b(?:will|shall)\s+be\s+(?:addressed|handled|resolved)\b|\btrained\s+professional\b.{0,50}\b(?:immediately|soon|arrive|contact)\b/
  );
}

function expectNaturalCallerIdentityQuestions(message: string): void {
  const questions = questionText(message);
  expect(questions).toMatch(
    /(?:fictional|made[- ]up|demo|alias|what\s+(?:name|should|can|may|would)[^?]{0,80}\b(?:call|use)\b)/
  );
  expect(questions).toMatch(
    /relationship|connected|affected\s+person|person\s+needing\s+help|nearby|witness|family|caregiver|someone\s+else/
  );
  expect(questions).not.toMatch(/\b(?:SELF|NEARBY_WITNESS|FAMILY_OR_CAREGIVER|OTHER)\b/i);
  expect(questions).not.toMatch(
    /bleed|injur|medical|burn|breath|safe|exit|route|water|access|reach|flame|smoke|location|district|landmark|where/
  );
}

function expectUrgentReview(analysis: Awaited<ReturnType<OllamaAiProvider["analyzeIntake"]>>) {
  expect(IntakeAnalysisSchema.safeParse(analysis).success).toBe(true);
  expect(analysis.readyForHumanReview).toBe(true);
  expect(analysis.urgency?.suggestedLevel).toBe("CRITICAL");
}

function expectUrgentReviewNotice(message: string): void {
  expect(message).toMatch(/\bsaved\b/i);
  expect(message).toMatch(/\bflagged\b/i);
  expect(message).toMatch(/\burgent\b/i);
  expect(message).toMatch(/\bhuman review\b/i);
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
      expect(assistantMessage).toMatch(/\bsaved\b/);
      expect(assistantMessage).toMatch(/\bflagged\b/);
      expect(assistantMessage).toMatch(
        /\b(?:urgent|immediate)\b[\s\S]{0,80}\bhuman review\b/
      );
      expectNoSensitiveReporterRequest(analysis.assistantMessage);
      expectNoDispatchPromise(analysis.assistantMessage);

      const questions = assistantMessage
        .split(/(?<=\?)\s+/)
        .filter((part) => part.includes("?"))
        .join(" ");
      expect(questions).toMatch(
        /bleed|injur|medical|safe|exit|route|road|access|water|smoke|fire|breath|trapped|hazard/
      );
      expect(questions).not.toMatch(/alias|relationship|reporter|caller|contact/);
      expect(questions).not.toMatch(/location|district|landmark|where/);
      expect(questions).not.toMatch(
        /how many|number of people|people affected|count/
      );
      expect(questions).toContain("?");
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
      expectUrgentReviewNotice(turnOne.assistantMessage);
      const turnOneQuestions = questionText(turnOne.assistantMessage);
      expect(turnOneQuestions).toMatch(/bleed|safe|exit|water|injur/);
      expect(turnOneQuestions).not.toMatch(
        /fictional\s+alias|reporter\s+alias|relationship\s+to\s+the\s+(?:victim|person)/
      );
      expectNoSensitiveReporterRequest(turnOne.assistantMessage);
      expectNoDispatchPromise(turnOne.assistantMessage);

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
      expectUrgentReviewNotice(turnTwo.assistantMessage);
      const turnTwoQuestions = questionText(turnTwo.assistantMessage);
      expectNaturalCallerIdentityQuestions(turnTwo.assistantMessage);
      expectNoRepeatedQuestion(turnTwo.assistantMessage, turnOne.assistantMessage);
      expect(turnTwoQuestions).not.toMatch(/phone|email|exact\s+address|gps|coordinate|live\s+location/);
      expectNoSensitiveReporterRequest(turnTwo.assistantMessage);
      expectNoDispatchPromise(turnTwo.assistantMessage);

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
      expectUrgentReviewNotice(turnThree.assistantMessage);
      expect(turnThree.factsPatch).toMatchObject({
        reporterAlias: "Scout",
        reporterRelationship: "NEARBY_WITNESS",
        reporterLocationDescription: "Demo Riverside Road District",
      });
      expect(turnThree.factsPatch.locationDescription).not.toBe(
        "Demo Riverside Road District"
      );
      expect(questionText(turnThree.assistantMessage)).not.toMatch(
        /alias|relationship|reporter|where are you|location|district|landmark/
      );
      expectNoRepeatedQuestion(turnThree.assistantMessage, turnTwo.assistantMessage);
      expectNoSensitiveReporterRequest(turnThree.assistantMessage);
      expectNoDispatchPromise(turnThree.assistantMessage);

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
      expectNoRepeatedQuestion(turnFour.assistantMessage, turnThree.assistantMessage);
      expectNoSensitiveReporterRequest(turnFour.assistantMessage);
      expectNoDispatchPromise(turnFour.assistantMessage);
    },
    300_000
  );
});
