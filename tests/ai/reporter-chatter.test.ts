/**
 * Multi-turn contract regressions for chatter about the person reporting an
 * incident. Reporter chatter is intentionally separate from victim facts.
 */
import { describe, expect, it, vi } from "vitest";
import { computeMessageStyle } from "@/features/ai/capitalization";
import { OllamaAiProvider } from "@/features/ai/ollama";
import {
  IntakeAnalysisSchema,
  type CaseFactsPatch,
  type IntakeInput,
} from "@/features/ai/provider";

const TURN_ONE_REPORT =
  "River is trapped with four other people in Simulation Block C. Floodwater is rising quickly, one person has a bleeding leg injury, and an elderly adult is with us.";
const TURN_TWO_ANSWER =
  "The bleeding is controlled and there is another safe exit. I am nearby but not at the house.";
const TURN_THREE_ANSWER =
  "Use the fictional alias Scout. I am River's neighbor, watching from Demo Riverside Road District.";
const TURN_FOUR_REPORT = "The water is still rising.";
const REPEATED_SAFETY_MESSAGE =
  "Your report was saved and flagged for urgent human review. Is the bleeding controlled? Is there another safe exit?";

const REPORTER_RELATIONSHIPS = [
  "SELF",
  "NEARBY_WITNESS",
  "FAMILY_OR_CAREGIVER",
  "OTHER",
] as const;

function makeAnalysis(
  factsPatch: Record<string, unknown>,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  return {
    assistantMessage:
      "Your report was saved and flagged for urgent human review. Is the bleeding controlled?",
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

function makeInput(
  confirmedFacts: Record<string, unknown>,
  publicMessages: IntakeInput["publicMessages"],
  latestReporterBody: string
): IntakeInput {
  // Keep this helper forward-compatible while the optional chatter fields are
  // added to the authoritative CaseFactsPatch type by the provider worker.
  return {
    confirmedFacts: confirmedFacts as CaseFactsPatch,
    publicMessages,
    latestMessageStyle: computeMessageStyle(latestReporterBody),
  };
}

function questionText(message: string): string {
  return message
    .split(/(?<=\?)\s+/)
    .filter((part) => part.includes("?"))
    .join(" ")
    .toLowerCase();
}

function assertNoSensitiveReporterRequest(message: string): void {
  const normalized = message.toLowerCase();
  expect(normalized).not.toMatch(
    /\b(?:real|full|legal)\s+name\b|\b(?:phone|telephone|mobile)(?:\s+number)?\b|\bemail(?:\s+address)?\b/
  );
  expect(normalized).not.toMatch(
    /\b(?:street|exact)\s+address\b|\b(?:gps|latitude|longitude|coordinates?)\b|\blive\s+location\b/
  );
}

describe("reporter chatter facts", () => {
  it("accepts separate fictional reporter alias, relationship enum, and coarse reporter location", () => {
    const analysis = expectSchemaSuccess(
      makeAnalysis({
        victimName: "River",
        locationDescription: "Simulation Block C",
        reporterAlias: "Scout",
        reporterRelationship: "NEARBY_WITNESS",
        reporterLocationDescription: "Demo Riverside Road District",
        immediateDanger: true,
      })
    );

    expect(analysis.factsPatch).toMatchObject({
      victimName: "River",
      locationDescription: "Simulation Block C",
      reporterAlias: "Scout",
      reporterRelationship: "NEARBY_WITNESS",
      reporterLocationDescription: "Demo Riverside Road District",
    });
    expect(analysis.factsPatch.victimName).not.toBe(
      analysis.factsPatch.reporterAlias
    );
  });

  it.each(REPORTER_RELATIONSHIPS)(
    "accepts reporterRelationship=%s",
    (reporterRelationship) => {
      const analysis = expectSchemaSuccess(
        makeAnalysis({
          reporterAlias: "Scout",
          reporterRelationship,
        })
      );

      expect(analysis.factsPatch.reporterRelationship).toBe(
        reporterRelationship
      );
    }
  );

  it("rejects an unknown reporter relationship enum value", () => {
    const result = IntakeAnalysisSchema.safeParse(
      makeAnalysis({
        reporterAlias: "Scout",
        reporterRelationship: "ROOMMATE",
      })
    );

    expect(result.success).toBe(false);
  });

  it.each([
    ["an empty alias", ""],
    ["an overlong alias", "A".repeat(41)],
    ["a phone number", "+1 555 0100"],
    ["an email address", "scout@example.com"],
    ["a URL", "https://example.test/scout"],
    ["a multiline value", "Scout\nBlock"],
  ])(
    "rejects %s as reporterAlias",
    (_description, reporterAlias) => {
      const result = IntakeAnalysisSchema.safeParse(
        makeAnalysis({
          reporterAlias,
          reporterRelationship: "NEARBY_WITNESS",
        })
      );

      expect(result.success).toBe(false);
    }
  );

  it.each([
    ["a generic real-name statement", "My real name is Scout."],
    ["a phone number", "My phone number is +1 555 0100."],
    ["an email address", "My email is scout@example.com."],
  ])("does not recover %s as reporterAlias", async (_description, message) => {
    const provider = new OllamaAiProvider();
    const modelOutput = makeAnalysis({ immediateDanger: true });
    const callOllama = vi.fn().mockResolvedValue(JSON.stringify(modelOutput));

    // @ts-expect-error accessing private method for deterministic transport mocking
    provider._callOllama = callOllama;

    const analysis = await provider.analyzeIntake({
      confirmedFacts: {},
      publicMessages: [{ role: "REPORTER", body: message }],
      latestMessageStyle: computeMessageStyle(message),
    });

    expect(callOllama).toHaveBeenCalledTimes(1);
    expect(analysis.factsPatch.reporterAlias).toBeUndefined();
  });

  it.each([
    "14.5995, 120.9842",
    "123 Main Street",
    "https://maps.example.test/?q=14.5995,120.9842",
  ])("rejects a precise reporter location: %s", (reporterLocationDescription) => {
    const result = IntakeAnalysisSchema.safeParse(
      makeAnalysis({
        reporterAlias: "Scout",
        reporterRelationship: "NEARBY_WITNESS",
        reporterLocationDescription,
      })
    );

    expect(result.success).toBe(false);
  });

  it("keeps CRITICAL readiness while a multi-turn exchange moves from safety to reporter chatter", async () => {
    const provider = new OllamaAiProvider();
    const turnOnePayload = makeAnalysis(
      {
        victimName: "River",
        locationDescription: "Simulation Block C",
        peopleAffected: 5,
        immediateDanger: true,
      },
      {
        missingFields: [
          "reporterAlias",
          "reporterRelationship",
          "reporterLocationDescription",
        ],
        assistantMessage:
          "Your report was saved and flagged for urgent human review. Is the bleeding controlled? Is there another safe exit?",
      }
    );
    const turnTwoPayload = makeAnalysis(
      { immediateDanger: true },
      {
        missingFields: ["reporterAlias", "reporterRelationship"],
        assistantMessage:
          "Your report was saved and flagged for urgent human review. If it is safe, what fictional alias should we use for you, and what is your relationship to the victim? Choose SELF, NEARBY_WITNESS, FAMILY_OR_CAREGIVER, or OTHER.",
      }
    );
    const turnThreePayload = makeAnalysis(
      {
        reporterAlias: "Scout",
        reporterRelationship: "NEARBY_WITNESS",
        reporterLocationDescription: "Demo Riverside Road District",
      },
      {
        assistantMessage:
          "Your report was saved and flagged for urgent human review. Is the water still rising?",
      }
    );
    const turnFourPayload = makeAnalysis(
      { immediateDanger: true },
      {
        assistantMessage:
          "Your report was saved and flagged for urgent human review. Is the bleeding still controlled?",
      }
    );
    const callOllama = vi
      .fn()
      .mockResolvedValueOnce(JSON.stringify(turnOnePayload))
      .mockResolvedValueOnce(JSON.stringify(turnTwoPayload))
      .mockResolvedValueOnce(JSON.stringify(turnThreePayload))
      .mockResolvedValueOnce(JSON.stringify(turnFourPayload));

    // @ts-expect-error accessing private method for deterministic transport mocking
    provider._callOllama = callOllama;

    const turnOneInput = makeInput(
      {},
      [{ role: "REPORTER", body: TURN_ONE_REPORT }],
      TURN_ONE_REPORT
    );
    const turnOne = await provider.analyzeIntake(turnOneInput);
    expect(turnOne.readyForHumanReview).toBe(true);
    expect(turnOne.urgency?.suggestedLevel).toBe("CRITICAL");
    expect(questionText(turnOne.assistantMessage)).toMatch(/bleed|safe|exit/);
    expect(questionText(turnOne.assistantMessage)).not.toMatch(
      /alias|relationship|reporter/
    );
    assertNoSensitiveReporterRequest(turnOne.assistantMessage);

    const turnTwoFacts = {
      ...turnOneInput.confirmedFacts,
      ...turnOne.factsPatch,
      injuriesOrMedicalNeeds: "Bleeding is controlled",
      accessHazards: ["Stairs are blocked by rising water"],
    };
    const turnTwoMessages: IntakeInput["publicMessages"] = [
      ...turnOneInput.publicMessages,
      { role: "AI", body: turnOne.assistantMessage },
      { role: "REPORTER", body: TURN_TWO_ANSWER },
    ];
    const turnTwo = await provider.analyzeIntake(
      makeInput(turnTwoFacts, turnTwoMessages, TURN_TWO_ANSWER)
    );
    expect(turnTwo.readyForHumanReview).toBe(true);
    expect(turnTwo.urgency?.suggestedLevel).toBe("CRITICAL");
    expect(questionText(turnTwo.assistantMessage)).toMatch(/fictional alias/);
    expect(questionText(turnTwo.assistantMessage)).toMatch(/relationship/);
    expect(questionText(turnTwo.assistantMessage)).not.toMatch(
      /reporter\s+(?:location|where)|location description|where are you/
    );
    expect(questionText(turnTwo.assistantMessage)).not.toMatch(
      /real|full|legal|phone|email|address|gps|coordinate|live location/
    );
    assertNoSensitiveReporterRequest(turnTwo.assistantMessage);

    const turnThreeFacts = {
      ...turnTwoFacts,
      ...turnTwo.factsPatch,
    };
    const turnThreeMessages: IntakeInput["publicMessages"] = [
      ...turnTwoMessages,
      { role: "AI", body: turnTwo.assistantMessage },
      { role: "REPORTER", body: TURN_THREE_ANSWER },
    ];
    const turnThree = await provider.analyzeIntake(
      makeInput(turnThreeFacts, turnThreeMessages, TURN_THREE_ANSWER)
    );
    expect(turnThree.readyForHumanReview).toBe(true);
    expect(turnThree.urgency?.suggestedLevel).toBe("CRITICAL");
    expect(turnThree.factsPatch).toMatchObject({
      reporterAlias: "Scout",
      reporterRelationship: "NEARBY_WITNESS",
      reporterLocationDescription: "Demo Riverside Road District",
    });
    expect(turnThreeFacts.locationDescription).toBe("Simulation Block C");
    assertNoSensitiveReporterRequest(turnThree.assistantMessage);

    const turnFourFacts = {
      ...turnThreeFacts,
      ...turnThree.factsPatch,
    };
    const turnFourMessages: IntakeInput["publicMessages"] = [
      ...turnThreeMessages,
      { role: "AI", body: turnThree.assistantMessage },
      { role: "REPORTER", body: TURN_FOUR_REPORT },
    ];
    const turnFour = await provider.analyzeIntake(
      makeInput(turnFourFacts, turnFourMessages, TURN_FOUR_REPORT)
    );
    expect(turnFourFacts).toMatchObject({
      victimName: "River",
      locationDescription: "Simulation Block C",
      reporterAlias: "Scout",
      reporterRelationship: "NEARBY_WITNESS",
      reporterLocationDescription: "Demo Riverside Road District",
    });
    expect(turnFour.readyForHumanReview).toBe(true);
    expect(turnFour.urgency?.suggestedLevel).toBe("CRITICAL");
    expect(questionText(turnFour.assistantMessage)).toMatch(/bleed|water|safe|exit/);
    expect(questionText(turnFour.assistantMessage)).not.toMatch(
      /alias|relationship|reporter|where are you|location|district|landmark/
    );
    assertNoSensitiveReporterRequest(turnFour.assistantMessage);

    expect(callOllama).toHaveBeenCalledTimes(4);
    const turnFourPrompt = callOllama.mock.calls[3]?.[0] as string;
    expect(turnFourPrompt).toContain('"reporterAlias": "Scout"');
    expect(turnFourPrompt).toContain(
      '"reporterRelationship": "NEARBY_WITNESS"'
    );
    expect(turnFourPrompt).toContain(
      '"reporterLocationDescription": "Demo Riverside Road District"'
    );
    expect(turnFourPrompt).toContain(TURN_ONE_REPORT);
  });

  it("overrides a repeated safety response with the approved chatter request without changing analysis facts", async () => {
    const provider = new OllamaAiProvider();
    const modelOutput = makeAnalysis(
      {
        victimName: "River",
        locationDescription: "Simulation Block C",
        peopleAffected: 5,
        immediateDanger: true,
        injuriesOrMedicalNeeds: "Bleeding is controlled",
        accessHazards: ["There is another safe exit"],
      },
      {
        assistantMessage: REPEATED_SAFETY_MESSAGE,
        missingFields: ["reporterAlias", "reporterRelationship"],
      }
    );
    const callOllama = vi.fn().mockResolvedValue(JSON.stringify(modelOutput));

    // @ts-expect-error accessing private method for deterministic transport mocking
    provider._callOllama = callOllama;

    const input = makeInput(
      {
        victimName: "River",
        locationDescription: "Simulation Block C",
        peopleAffected: 5,
        immediateDanger: true,
        injuriesOrMedicalNeeds: "Bleeding is controlled",
        accessHazards: ["There is another safe exit"],
      },
      [
        { role: "REPORTER", body: TURN_ONE_REPORT },
        {
          role: "AI",
          body: "Your report was saved and flagged for urgent human review. Is the bleeding controlled? Is there another safe exit?",
        },
        { role: "REPORTER", body: TURN_TWO_ANSWER },
      ],
      TURN_TWO_ANSWER
    );
    const result = await provider.analyzeIntake(input);

    expect(result.assistantMessage).toMatch(
      /fictional\s+(?:chatter\s+)?alias/i
    );
    expect(result.assistantMessage).toMatch(
      /relationship.*(?:SELF|NEARBY_WITNESS|FAMILY_OR_CAREGIVER|OTHER)/i
    );
    expect(result.assistantMessage).toMatch(
      /saved and flagged for urgent human review/i
    );
    expect(questionText(result.assistantMessage)).not.toMatch(
      /bleeding|safe\s+exit|injur(?:y|ies)|water|route|access/
    );
    assertNoSensitiveReporterRequest(result.assistantMessage);

    expect(result.factsPatch).toEqual(modelOutput.factsPatch);
    expect(result.urgency).toEqual(modelOutput.urgency);
    expect(result.readyForHumanReview).toBe(modelOutput.readyForHumanReview);
    expect(result.missingFields).toEqual(modelOutput.missingFields);
    expect(result.proposedTasks).toEqual(modelOutput.proposedTasks);
  });

  it("does not re-ask reporter facts already supplied in the current result", async () => {
    const provider = new OllamaAiProvider();
    const modelOutput = makeAnalysis(
      {
        victimName: "River",
        locationDescription: "Simulation Block C",
        reporterAlias: "Scout",
        reporterRelationship: "NEARBY_WITNESS",
        reporterLocationDescription: "Demo Riverside Road District",
        immediateDanger: true,
      },
      {
        assistantMessage: `${REPEATED_SAFETY_MESSAGE} What fictional alias should we use, and what is your relationship to the victim?`,
        missingFields: [],
      }
    );
    const callOllama = vi.fn().mockResolvedValue(JSON.stringify(modelOutput));

    // @ts-expect-error accessing private method for deterministic transport mocking
    provider._callOllama = callOllama;

    const input = makeInput(
      {
        victimName: "River",
        locationDescription: "Simulation Block C",
        peopleAffected: 5,
        immediateDanger: true,
        injuriesOrMedicalNeeds: "Bleeding is controlled",
        accessHazards: ["There is another safe exit"],
      },
      [
        { role: "REPORTER", body: TURN_ONE_REPORT },
        {
          role: "AI",
          body: "Your report was saved and flagged for urgent human review. Is the bleeding controlled? Is there another safe exit?",
        },
        { role: "REPORTER", body: TURN_TWO_ANSWER },
      ],
      TURN_TWO_ANSWER
    );
    const result = await provider.analyzeIntake(input);

    const questions = questionText(result.assistantMessage);
    expect(questions).not.toMatch(
      /fictional\s+(?:chatter\s+)?alias|reporter\s+alias|relationship\s+to\s+the\s+victim/
    );
    expect(result.factsPatch).toEqual(modelOutput.factsPatch);
    expect(result.urgency).toEqual(modelOutput.urgency);
    expect(result.readyForHumanReview).toBe(modelOutput.readyForHumanReview);
  });
});
