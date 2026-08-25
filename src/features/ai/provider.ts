/**
 * src/features/ai/provider.ts — ReliefAiProvider interface and IntakeAnalysis Zod schema.
 *
 * This is the single authoritative schema for AI output. Every validation in the
 * project must use this module; do not create a competing schema.
 *
 * Server-only — never import in browser code.
 */
import { z } from "zod";

// ---------------------------------------------------------------------------
// MessageStyleSignals — computed deterministically by application code
// ---------------------------------------------------------------------------

export type MessageStyleSignals = {
  uppercaseLetterRatio: number;
  uppercaseEmphasis: "NONE" | "SOME" | "STRONG";
};

// ---------------------------------------------------------------------------
// CaseFactsPatch — allowed structured fact updates
// ---------------------------------------------------------------------------

export type CaseFactsPatch = {
  incidentType?: string | null;
  locationDescription?: string | null;
  peopleAffected?: number | null;
  peopleAffectedUnknown?: boolean;
  immediateDanger?: boolean | null;
  injuriesOrMedicalNeeds?: string | null;
  vulnerablePeople?: string[];
  essentialNeeds?: string[];
  accessHazards?: string[];
  additionalDetails?: string | null;
  reporterRequestedHuman?: boolean;
};

// ---------------------------------------------------------------------------
// IntakeInput — what the application sends to the provider
// ---------------------------------------------------------------------------

export type IntakeInput = {
  /** Current case facts JSON */
  confirmedFacts: CaseFactsPatch;
  /** Latest 8 public messages */
  publicMessages: Array<{ role: "REPORTER" | "AI" | "COORDINATOR"; body: string }>;
  /** Capitalization statistics derived by application code from latest raw reporter message */
  latestMessageStyle: MessageStyleSignals;
};

// ---------------------------------------------------------------------------
// IntakeAnalysis Zod schema — strict, must reject unknown keys
// ---------------------------------------------------------------------------

const CaseFactsPatchSchema = z
  .object({
    incidentType: z.string().nullable().optional(),
    locationDescription: z.string().nullable().optional(),
    peopleAffected: z.number().int().nonnegative().nullable().optional(),
    peopleAffectedUnknown: z.boolean().optional(),
    immediateDanger: z.boolean().nullable().optional(),
    injuriesOrMedicalNeeds: z.string().nullable().optional(),
    vulnerablePeople: z.array(z.string()).optional(),
    essentialNeeds: z.array(z.string()).optional(),
    accessHazards: z.array(z.string()).optional(),
    additionalDetails: z.string().nullable().optional(),
    reporterRequestedHuman: z.boolean().optional(),
  })
  .strict();

const MissingFieldSchema = z.enum([
  "incidentType",
  "locationDescription",
  "peopleAffected",
  "immediateDanger",
  "injuriesOrMedicalNeeds",
  "vulnerablePeople",
  "essentialNeeds",
  "accessHazards",
]);

const UrgencyFactorSchema = z
  .object({
    name: z.enum([
      "IMMEDIATE_DANGER",
      "PEOPLE_AFFECTED",
      "VULNERABILITY",
      "ESSENTIAL_NEEDS",
      "ACCESS_HAZARDS",
      "MISSING_INFORMATION",
    ]),
    severity: z.enum(["HIGH", "MEDIUM", "LOW"]),
    explanation: z.string().min(1),
  })
  .strict();

const UrgencySchema = z
  .object({
    suggestedLevel: z.enum(["CRITICAL", "HIGH", "MEDIUM", "LOW"]),
    confidence: z.number().min(0).max(1),
    factors: z.array(UrgencyFactorSchema).max(6),
    missingInformation: z.array(z.string()),
    rationale: z.string().min(1),
  })
  .strict();

const ProposedTaskSchema = z
  .object({
    title: z.string().min(1).max(120),
    details: z.string().max(500).optional(),
    proposedOwner: z.string().optional(),
  })
  .strict();

const CommunicationSignalsSchema = z
  .object({
    analysisNormalizationApplied: z.boolean(),
    apparentSpellingIssueLevel: z.enum(["NONE", "SOME", "MANY"]),
    uppercaseLetterRatio: z.number().min(0).max(1),
    uppercaseEmphasis: z.enum(["NONE", "SOME", "STRONG"]),
    possibleDistress: z.enum(["NOT_INDICATED", "POSSIBLE", "ELEVATED"]),
    explanation: z.string().min(1).max(300),
  })
  .strict();

/**
 * Strict Zod schema for the IntakeAnalysis output.
 * Use IntakeAnalysisSchema.parse() to validate and IntakeAnalysis for the type.
 */
export const IntakeAnalysisSchema = z
  .object({
    assistantMessage: z.string().min(1).max(600),
    factsPatch: CaseFactsPatchSchema,
    missingFields: z.array(MissingFieldSchema),
    readyForHumanReview: z.boolean(),
    communicationSignals: CommunicationSignalsSchema,
    urgency: UrgencySchema.optional(),
    proposedTasks: z.array(ProposedTaskSchema).max(6).optional(),
  })
  .strict()
  .superRefine((data, ctx) => {
    // urgency and proposedTasks are required when readyForHumanReview=true
    if (data.readyForHumanReview) {
      if (!data.urgency) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "urgency is required when readyForHumanReview=true",
          path: ["urgency"],
        });
      }
      if (!data.proposedTasks) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "proposedTasks is required when readyForHumanReview=true",
          path: ["proposedTasks"],
        });
      }
    }
    // proposedTasks must be absent while still gathering routine intake answers
    if (!data.readyForHumanReview && data.proposedTasks !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "proposedTasks must be absent while readyForHumanReview=false",
        path: ["proposedTasks"],
      });
    }
  });

export type IntakeAnalysis = z.infer<typeof IntakeAnalysisSchema>;

// ---------------------------------------------------------------------------
// Provider interface
// ---------------------------------------------------------------------------

export interface ReliefAiProvider {
  analyzeIntake(input: IntakeInput): Promise<IntakeAnalysis>;
  healthCheck(): Promise<{ ok: boolean; message?: string }>;
}
