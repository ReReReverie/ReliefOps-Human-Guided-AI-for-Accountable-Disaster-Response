/**
 * src/features/ai/mock.ts — MockAiProvider with deterministic fixtures.
 *
 * From chatbot-spec §12:
 *   - Must return objects that pass the same Zod schema.
 *   - Select fixtures deterministically from explicit synthetic scenario IDs.
 *   - Fixtures must cover: Scenario A (CRITICAL), Scenario B (incomplete), Scenario C (MEDIUM/LOW).
 *
 * The "Simulated AI Preview" label is shown by the UI when AI_PROVIDER=mock.
 *
 * Server-only — never import in browser code.
 */
import type {
  ReliefAiProvider,
  IntakeInput,
  IntakeAnalysis,
} from "./provider";

/** Synthetic scenario IDs for deterministic fixture selection. */
export type MockScenarioId = "A" | "B" | "C" | "D" | "E" | "H" | "I" | "J" | "K" | "L";

/**
 * Deterministic fixture map — one IntakeAnalysis per scenario ID.
 * All objects pass IntakeAnalysisSchema.
 */
const FIXTURES: Record<MockScenarioId, IntakeAnalysis> = {
  // Scenario A: Immediate danger — five people trapped, water rising, one injured
  A: {
    assistantMessage:
      "I understand this is an urgent situation. Five people are trapped on the second floor with rising water and an injured person. I have flagged this case for immediate human review. Please stay in a safe location if possible. A human coordinator will review this shortly.",
    factsPatch: {
      incidentType: "flooding",
      peopleAffected: 5,
      immediateDanger: true,
      injuriesOrMedicalNeeds: "one injured person",
    },
    missingFields: ["locationDescription"],
    readyForHumanReview: true,
    communicationSignals: {
      analysisNormalizationApplied: false,
      apparentSpellingIssueLevel: "NONE",
      uppercaseLetterRatio: 0,
      uppercaseEmphasis: "NONE",
      possibleDistress: "ELEVATED",
      explanation:
        "Possible elevated distress cue: message describes immediate life danger with trapped people and rising water.",
    },
    urgency: {
      suggestedLevel: "CRITICAL",
      confidence: 0.9,
      factors: [
        {
          name: "IMMEDIATE_DANGER",
          severity: "HIGH",
          explanation:
            "Five people reportedly trapped on second floor with rapidly rising water.",
        },
        {
          name: "PEOPLE_AFFECTED",
          severity: "HIGH",
          explanation: "Five people affected including one with reported injury.",
        },
        {
          name: "MISSING_INFORMATION",
          severity: "MEDIUM",
          explanation:
            "Synthetic location has not been confirmed; uncertainty does not reduce urgency given the immediate danger report.",
        },
      ],
      missingInformation: ["locationDescription"],
      rationale:
        "Immediate life threat: people trapped with rising water and reported injury. AI Suggested Urgency: CRITICAL.",
    },
    proposedTasks: [
      {
        title: "Confirm synthetic location and access route",
        details:
          "Ask reporter for the synthetic district or landmark to direct response team for human approval.",
      },
      {
        title: "Review reported injury details",
        details:
          "Clarify the nature of the injury with the reporter for coordinator review.",
      },
      {
        title: "Prepare resource request for human approval",
        details:
          "Identify potential rescue and medical resources for coordinator review and approval.",
      },
    ],
  },

  // Scenario B: Incomplete report — only storm mentioned
  B: {
    assistantMessage:
      "Thank you for reaching out. I can see you need help after a storm. To help a coordinator understand the situation: What is your approximate synthetic location? Is anyone in immediate danger right now?",
    factsPatch: {
      incidentType: "storm damage",
    },
    missingFields: [
      "locationDescription",
      "peopleAffected",
      "immediateDanger",
      "injuriesOrMedicalNeeds",
      "vulnerablePeople",
      "essentialNeeds",
      "accessHazards",
    ],
    readyForHumanReview: false,
    communicationSignals: {
      analysisNormalizationApplied: false,
      apparentSpellingIssueLevel: "NONE",
      uppercaseLetterRatio: 0,
      uppercaseEmphasis: "NONE",
      possibleDistress: "NOT_INDICATED",
      explanation:
        "No notable communication style cues detected in this message.",
    },
  },

  // Scenario C: Non-immediate essential need — two adults, water needed
  C: {
    assistantMessage:
      "I understand two adults need drinking water. Since there is no immediate danger and access is open, I have logged the essential need. A coordinator will review the situation. Is there anything else that has changed?",
    factsPatch: {
      peopleAffected: 2,
      immediateDanger: false,
      essentialNeeds: ["drinking water"],
      accessHazards: [],
    },
    missingFields: ["locationDescription"],
    readyForHumanReview: true,
    communicationSignals: {
      analysisNormalizationApplied: false,
      apparentSpellingIssueLevel: "NONE",
      uppercaseLetterRatio: 0,
      uppercaseEmphasis: "NONE",
      possibleDistress: "NOT_INDICATED",
      explanation:
        "No notable communication style cues detected in this message.",
    },
    urgency: {
      suggestedLevel: "MEDIUM",
      confidence: 0.75,
      factors: [
        {
          name: "ESSENTIAL_NEEDS",
          severity: "MEDIUM",
          explanation:
            "Two adults require drinking water, needed tomorrow. No immediate danger reported.",
        },
        {
          name: "MISSING_INFORMATION",
          severity: "LOW",
          explanation: "Synthetic location not yet confirmed.",
        },
      ],
      missingInformation: ["locationDescription"],
      rationale:
        "Essential need for drinking water with no immediate danger. Assistance is important but not life-threatening. AI Suggested Urgency: MEDIUM.",
    },
    proposedTasks: [
      {
        title: "Confirm synthetic location for water delivery coordination",
        details: "Ask reporter for their synthetic district for coordinator review.",
      },
      {
        title: "Identify water supply options for human approval",
        details:
          "Prepare list of potential water supply resources for coordinator review and approval.",
      },
    ],
  },

  // Scenario D: Correction — earlier message said 3 people, reporter now corrects to 4
  D: {
    assistantMessage:
      "Thank you for the update. I have recorded that four people are affected. Is there anything else about the situation I should note for the coordinator?",
    factsPatch: {
      peopleAffected: 4,
    },
    missingFields: [
      "locationDescription",
      "immediateDanger",
      "injuriesOrMedicalNeeds",
      "vulnerablePeople",
      "essentialNeeds",
      "accessHazards",
    ],
    readyForHumanReview: false,
    communicationSignals: {
      analysisNormalizationApplied: false,
      apparentSpellingIssueLevel: "NONE",
      uppercaseLetterRatio: 0,
      uppercaseEmphasis: "NONE",
      possibleDistress: "NOT_INDICATED",
      explanation:
        "No notable communication style cues detected in this message.",
    },
  },

  // Scenario E: Prompt injection — reporter attempts to override rules
  E: {
    assistantMessage:
      "I have noted your message. To help a coordinator understand the situation: What happened? What is the approximate synthetic location, and is anyone in immediate danger right now?",
    factsPatch: {},
    missingFields: [
      "incidentType",
      "locationDescription",
      "peopleAffected",
      "immediateDanger",
    ],
    readyForHumanReview: false,
    communicationSignals: {
      analysisNormalizationApplied: false,
      apparentSpellingIssueLevel: "NONE",
      uppercaseLetterRatio: 0,
      uppercaseEmphasis: "NONE",
      possibleDistress: "NOT_INDICATED",
      explanation:
        "No notable communication style cues detected in this message.",
    },
  },

  // Scenario H: Obvious spelling mistakes
  H: {
    assistantMessage:
      "I can see what appears to be a flooding situation with rising water and multiple people affected. To help a coordinator act quickly: Can you confirm your approximate synthetic location? Is anyone injured?",
    factsPatch: {
      incidentType: "flooding",
      peopleAffected: 4,
      immediateDanger: true,
      additionalDetails: "water is rising",
    },
    missingFields: ["locationDescription", "injuriesOrMedicalNeeds"],
    readyForHumanReview: true,
    communicationSignals: {
      analysisNormalizationApplied: true,
      apparentSpellingIssueLevel: "MANY",
      uppercaseLetterRatio: 0,
      uppercaseEmphasis: "NONE",
      possibleDistress: "POSSIBLE",
      explanation:
        "Possible distress cue: message contains many apparent spelling variations, which may indicate hurried typing or distress. The underlying situation (flooding, rising water) independently determines urgency.",
    },
    urgency: {
      suggestedLevel: "CRITICAL",
      confidence: 0.75,
      factors: [
        {
          name: "IMMEDIATE_DANGER",
          severity: "HIGH",
          explanation: "Rising water reported with multiple people affected.",
        },
        {
          name: "PEOPLE_AFFECTED",
          severity: "HIGH",
          explanation: "Four people reportedly affected.",
        },
        {
          name: "MISSING_INFORMATION",
          severity: "MEDIUM",
          explanation:
            "Synthetic location and injury details unknown; uncertainty does not reduce urgency.",
        },
      ],
      missingInformation: ["locationDescription", "injuriesOrMedicalNeeds"],
      rationale:
        "Rapidly rising water with multiple people affected indicates immediate danger. AI Suggested Urgency: CRITICAL.",
    },
    proposedTasks: [
      {
        title: "Confirm synthetic location immediately",
        details:
          "Reporter appears to be in immediate danger; location is critical for coordinator response planning.",
      },
      {
        title: "Clarify injury status",
        details: "Determine if anyone has injuries requiring medical attention.",
      },
    ],
  },

  // Scenario I: HELP — capitals without incident details
  I: {
    assistantMessage:
      "I received your message. To help a coordinator understand what is happening: What happened? Is anyone in immediate danger right now?",
    factsPatch: {},
    missingFields: [
      "incidentType",
      "locationDescription",
      "peopleAffected",
      "immediateDanger",
    ],
    readyForHumanReview: false,
    communicationSignals: {
      analysisNormalizationApplied: false,
      apparentSpellingIssueLevel: "NONE",
      uppercaseLetterRatio: 1,
      uppercaseEmphasis: "STRONG",
      possibleDistress: "POSSIBLE",
      explanation:
        "Possible distress cue: message is written entirely in capitals, which may indicate urgency or distress. No incident facts have been provided yet to assess the situation.",
    },
  },

  // Scenario J: Capitals + immediate danger facts
  J: {
    assistantMessage:
      "I understand this is an urgent situation. Five people are reportedly trapped with rising water. I have flagged this for immediate human review. Please stay safe if possible. A human coordinator will review shortly.",
    factsPatch: {
      incidentType: "flooding",
      peopleAffected: 5,
      immediateDanger: true,
      additionalDetails: "water is rising",
    },
    missingFields: ["locationDescription", "injuriesOrMedicalNeeds"],
    readyForHumanReview: true,
    communicationSignals: {
      analysisNormalizationApplied: false,
      apparentSpellingIssueLevel: "NONE",
      uppercaseLetterRatio: 1,
      uppercaseEmphasis: "STRONG",
      possibleDistress: "ELEVATED",
      explanation:
        "Possible elevated distress cue: strong capitalization combined with urgent wording about trapped people and rising water. Urgency is based on the reported facts, not the capitalization.",
    },
    urgency: {
      suggestedLevel: "CRITICAL",
      confidence: 0.9,
      factors: [
        {
          name: "IMMEDIATE_DANGER",
          severity: "HIGH",
          explanation: "Five people reportedly trapped with rapidly rising water.",
        },
        {
          name: "PEOPLE_AFFECTED",
          severity: "HIGH",
          explanation: "Five people affected.",
        },
        {
          name: "MISSING_INFORMATION",
          severity: "MEDIUM",
          explanation: "Synthetic location not confirmed.",
        },
      ],
      missingInformation: ["locationDescription"],
      rationale:
        "People trapped with rising water constitutes an immediate life threat. AI Suggested Urgency: CRITICAL. Note: strong capitalization is a secondary possible communication cue only; the reported facts are the primary basis.",
    },
    proposedTasks: [
      {
        title: "Confirm synthetic location immediately",
        details: "Critical for coordinator response planning.",
      },
      {
        title: "Assess injury status",
        details: "Determine if anyone has injuries requiring medical attention.",
      },
      {
        title: "Prepare resource request for human approval",
        details:
          "Identify potential rescue resources for coordinator review and approval.",
      },
    ],
  },

  // Scenario K: Immediate danger written calmly (lowercase)
  K: {
    assistantMessage:
      "I understand five people are trapped with rapidly rising water. This is an urgent situation and I have flagged it for immediate human review. A coordinator will review this shortly.",
    factsPatch: {
      incidentType: "flooding",
      peopleAffected: 5,
      immediateDanger: true,
      additionalDetails: "water is rapidly rising",
    },
    missingFields: ["locationDescription", "injuriesOrMedicalNeeds"],
    readyForHumanReview: true,
    communicationSignals: {
      analysisNormalizationApplied: false,
      apparentSpellingIssueLevel: "NONE",
      uppercaseLetterRatio: 0.05,
      uppercaseEmphasis: "NONE",
      possibleDistress: "NOT_INDICATED",
      explanation:
        "No notable communication style cues. Message is written calmly in lowercase; this does not reduce urgency or confidence given the clear report of trapped people and rising water.",
    },
    urgency: {
      suggestedLevel: "CRITICAL",
      confidence: 0.9,
      factors: [
        {
          name: "IMMEDIATE_DANGER",
          severity: "HIGH",
          explanation: "Five people trapped with rapidly rising water.",
        },
        {
          name: "PEOPLE_AFFECTED",
          severity: "HIGH",
          explanation: "Five people affected.",
        },
        {
          name: "MISSING_INFORMATION",
          severity: "MEDIUM",
          explanation: "Synthetic location not confirmed.",
        },
      ],
      missingInformation: ["locationDescription"],
      rationale:
        "Immediate life threat: people trapped with rising water. Clear lowercase writing does not reduce urgency. AI Suggested Urgency: CRITICAL.",
    },
    proposedTasks: [
      {
        title: "Confirm synthetic location immediately",
        details: "Critical for coordinator response planning.",
      },
      {
        title: "Assess injury status",
        details: "Determine if anyone has injuries requiring medical attention.",
      },
    ],
  },

  // Scenario L: Ambiguous possible correction ("tree" vs "three")
  L: {
    assistantMessage:
      "I noticed your message mentions 'tree people trapped.' Did you mean 'three people'? I am flagging the trapped-person report for immediate human review while we clarify. Could you confirm: is 'tree' a typo for 'three', and what is the approximate synthetic location?",
    factsPatch: {
      immediateDanger: true,
    },
    missingFields: [
      "locationDescription",
      "peopleAffected",
      "injuriesOrMedicalNeeds",
    ],
    readyForHumanReview: true,
    communicationSignals: {
      analysisNormalizationApplied: false,
      apparentSpellingIssueLevel: "SOME",
      uppercaseLetterRatio: 0.09,
      uppercaseEmphasis: "NONE",
      possibleDistress: "NOT_INDICATED",
      explanation:
        "One apparent spelling variation noted ('tree' possibly meaning 'three'). Ambiguous — not silently corrected to avoid changing a case fact.",
    },
    urgency: {
      suggestedLevel: "HIGH",
      confidence: 0.5,
      factors: [
        {
          name: "IMMEDIATE_DANGER",
          severity: "HIGH",
          explanation: "People reportedly trapped; immediate danger flagged.",
        },
        {
          name: "MISSING_INFORMATION",
          severity: "HIGH",
          explanation:
            "Number of people ambiguous ('tree' vs 'three'); synthetic location unknown. Uncertainty lowers confidence but not urgency given the trapped-person report.",
        },
      ],
      missingInformation: ["peopleAffected", "locationDescription"],
      rationale:
        "Trapped people reported; immediate danger flagged. Count is ambiguous and not silently assumed. Low confidence due to missing information. AI Suggested Urgency: HIGH.",
    },
    proposedTasks: [
      {
        title: "Clarify number of people affected",
        details:
          "Reporter wrote 'tree people'; coordinator should confirm whether this means 'three'.",
      },
      {
        title: "Confirm synthetic location",
        details: "Critical for coordinator response planning.",
      },
    ],
  },
};

// ---------------------------------------------------------------------------
// MockAiProvider
// ---------------------------------------------------------------------------

export class MockAiProvider implements ReliefAiProvider {
  /**
   * Scenario ID to use. Defaults to "B" (incomplete report).
   * Set this before calling analyzeIntake in tests.
   */
  scenarioId: MockScenarioId = "B";

  constructor(scenarioId?: MockScenarioId) {
    if (scenarioId) {
      this.scenarioId = scenarioId;
    }
  }

  async analyzeIntake(input: IntakeInput): Promise<IntakeAnalysis> {
    const fixture = FIXTURES[this.scenarioId];
    if (!fixture) {
      throw new Error(`MockAiProvider: unknown scenario ID '${this.scenarioId}'`);
    }

    // Override capitalization cues with application-calculated values (spec §5)
    const result: IntakeAnalysis = {
      ...fixture,
      communicationSignals: {
        ...fixture.communicationSignals,
        uppercaseLetterRatio: input.latestMessageStyle.uppercaseLetterRatio,
        uppercaseEmphasis: input.latestMessageStyle.uppercaseEmphasis,
      },
    };

    return result;
  }

  async healthCheck(): Promise<{ ok: boolean; message?: string }> {
    return { ok: true, message: "Mock provider always healthy" };
  }
}

/** Export the fixture map for direct use in tests. */
export { FIXTURES as MOCK_FIXTURES };
