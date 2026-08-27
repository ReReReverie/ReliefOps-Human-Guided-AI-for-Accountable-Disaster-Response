/**
 * /ops/cases/[id] — Case detail page.
 *
 * Protected in production. Local development may explicitly use the seeded
 * coordinator identity without a login session.
 * Four sections (plan §9):
 *   1. Chat transcript + Take Over / Resume AI controls
 *   2. Confirmed facts + AI urgency breakdown + separately labelled communication cues
 *   3. Human Final Urgency form
 *   4. Task checklist + audit record status
 *
 * Server Component — data loaded here.
 * Interactive sections use Client Components.
 */
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { requireCoordinatorSession } from "@/lib/auth/coordinator";
import { getDb, schema } from "@/lib/db";
import { isUuid } from "@/lib/ids";
import { eq, desc } from "drizzle-orm";
import { ChatControls } from "@/features/cases/ChatControls";
import { UrgencyForm } from "@/features/cases/UrgencyForm";
import { TaskList } from "@/features/cases/TaskList";
import { CaseControls } from "@/features/cases/CaseControls";
import { AuditRetryButton } from "@/features/cases/AuditRetryButton";
import type { CaseFactsPatch } from "@/features/ai/provider";

export const dynamic = "force-dynamic";

// ---------------------------------------------------------------------------
// Data loading
// ---------------------------------------------------------------------------

async function loadCaseDetail(id: string) {
  const db = getDb();

  const caseRow = await db.query.reliefCases.findFirst({
    where: eq(schema.reliefCases.id, id),
  });
  if (!caseRow) return null;

  const msgs = await db.query.messages.findMany({
    where: eq(schema.messages.caseId, id),
    orderBy: [schema.messages.createdAt],
  });

  const assessments = await db.query.urgencyAssessments.findMany({
    where: eq(schema.urgencyAssessments.caseId, id),
    orderBy: [desc(schema.urgencyAssessments.createdAt)],
  });

  const caseTasks = await db.query.tasks.findMany({
    where: eq(schema.tasks.caseId, id),
    orderBy: [schema.tasks.position],
  });

  const auditRecord = await db.query.auditRecords.findFirst({
    where: eq(schema.auditRecords.caseId, id),
  });

  const latestAiAssessment = assessments.find((a) => a.source === "AI") ?? null;
  const latestHumanAssessment =
    assessments.find((a) => a.source === "HUMAN") ?? null;

  // Latest AI message with communicationSignals in aiMetadata
  const latestAiMessage = [...msgs]
    .reverse()
    .find((m) => m.senderType === "AI" && m.aiMetadata);

  return {
    caseRow,
    messages: msgs,
    latestAiAssessment,
    latestHumanAssessment,
    tasks: caseTasks,
    auditRecord,
    latestAiMessage,
  };
}

// ---------------------------------------------------------------------------
// Sub-components (server-rendered)
// ---------------------------------------------------------------------------

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-base font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-3">
      {title}
    </h2>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
      {children}
    </div>
  );
}

// Chat transcript
function MessageBubble({
  senderType,
  body,
  createdAt,
  displayName,
}: {
  senderType: string;
  body: string;
  createdAt: Date;
  displayName?: string;
}) {
  const isReporter = senderType === "REPORTER";
  const isCoordinator = senderType === "COORDINATOR";

  const label = isReporter
    ? "Reporter"
    : isCoordinator
      ? displayName ?? "Coordinator"
      : "ReliefOps AI";

  const bubbleColor = isReporter
    ? "bg-gray-100"
    : isCoordinator
      ? "bg-amber-50 border border-amber-200"
      : "bg-blue-50 border border-blue-200";

  return (
    <div className={`rounded p-2.5 ${bubbleColor}`}>
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-xs font-semibold text-gray-700">{label}</span>
        <span className="text-xs text-gray-400">
          {createdAt.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      {/* Raw message: displayed exactly as stored — no HTML rendering */}
      <pre className="text-sm text-gray-900 whitespace-pre-wrap font-sans break-words">
        {body}
      </pre>
    </div>
  );
}

// Confirmed facts display
function FactsDisplay({ facts }: { facts: CaseFactsPatch }) {
  const entries = Object.entries(facts).filter(
    ([, v]) => v !== null && v !== undefined && v !== false
  );

  if (entries.length === 0) {
    return <p className="text-sm text-gray-500">No confirmed facts yet.</p>;
  }

  const LABELS: Record<string, string> = {
    incidentType: "Incident Type",
    locationDescription: "Location",
    peopleAffected: "People Affected",
    peopleAffectedUnknown: "People Affected",
    immediateDanger: "Immediate Danger",
    injuriesOrMedicalNeeds: "Injuries / Medical Needs",
    vulnerablePeople: "Vulnerable People",
    essentialNeeds: "Essential Needs",
    accessHazards: "Access Hazards",
    additionalDetails: "Additional Details",
  };

  return (
    <dl className="space-y-1">
      {entries.map(([key, value]) => {
        if (key === "reporterRequestedHuman") return null;
        let display: string;
        if (Array.isArray(value)) {
          display = value.join(", ");
        } else if (key === "peopleAffectedUnknown" && value === true) {
          display = "Unknown";
        } else {
          display = String(value);
        }
        return (
          <div key={key} className="flex gap-2">
            <dt className="text-xs font-medium text-gray-500 w-40 flex-shrink-0">
              {LABELS[key] ?? key}
            </dt>
            <dd className="text-sm text-gray-900 break-words">{display}</dd>
          </div>
        );
      })}
    </dl>
  );
}

// AI urgency breakdown
type UrgencyAssessmentRow = {
  urgencyLevel: string;
  confidence: string | null;
  factorBreakdown: unknown;
  missingInformation: unknown;
  rationale: string;
};

function AiUrgencyDisplay({
  assessment,
}: {
  assessment: UrgencyAssessmentRow;
}) {
  const factors = assessment.factorBreakdown as Array<{
    name: string;
    severity: string;
    explanation: string;
  }>;
  const missingInfo = assessment.missingInformation as string[] | null;

  const SEVERITY_COLOR: Record<string, string> = {
    HIGH: "text-red-600",
    MEDIUM: "text-yellow-600",
    LOW: "text-gray-500",
  };

  const URGENCY_COLOR: Record<string, string> = {
    CRITICAL: "text-red-700 font-bold",
    HIGH: "text-orange-600 font-semibold",
    MEDIUM: "text-yellow-700 font-semibold",
    LOW: "text-gray-600",
  };

  return (
    <div className="space-y-2">
      <div className="text-sm">
        <span className="text-gray-600">AI Suggested Urgency: </span>
        <span className={URGENCY_COLOR[assessment.urgencyLevel] ?? "font-semibold"}>
          {assessment.urgencyLevel}
        </span>
        {assessment.confidence && (
          <span className="ml-2 text-gray-500 text-xs">
            (confidence: {(parseFloat(assessment.confidence) * 100).toFixed(0)}%)
          </span>
        )}
      </div>

      {assessment.rationale && (
        <p className="text-sm text-gray-700">{assessment.rationale}</p>
      )}

      {factors && factors.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">Factors</p>
          <ul className="space-y-1">
            {factors.map((f, i) => (
              <li key={i} className="text-sm flex gap-2">
                <span
                  className={`text-xs font-medium w-20 flex-shrink-0 ${SEVERITY_COLOR[f.severity] ?? ""}`}
                >
                  {f.name}
                </span>
                <span className="text-gray-700">{f.explanation}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {missingInfo && missingInfo.length > 0 && (
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1">
            Missing Information
          </p>
          <ul className="list-disc list-inside space-y-0.5">
            {missingInfo.map((m, i) => (
              <li key={i} className="text-sm text-gray-600">
                {m}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// Communication cues — separately labelled, non-diagnostic (spec §4)
function CommunicationCuesDisplay({
  aiMetadata,
}: {
  aiMetadata: Record<string, unknown>;
}) {
  const signals = aiMetadata.communicationSignals as
    | {
        possibleDistress: string;
        apparentSpellingIssueLevel: string;
        uppercaseEmphasis: string;
        uppercaseLetterRatio: number;
        explanation: string;
        analysisNormalizationApplied?: boolean;
      }
    | undefined;

  if (!signals) return null;

  const DISTRESS_COLOR: Record<string, string> = {
    NOT_INDICATED: "text-gray-600",
    POSSIBLE: "text-yellow-700",
    ELEVATED: "text-orange-700 font-semibold",
  };

  return (
    <div className="border border-amber-200 bg-amber-50 rounded p-3 space-y-2">
      {/* Non-negotiable label from spec §4 */}
      <p className="text-sm font-semibold text-amber-800">
        Possible Communication Distress (AI, non-diagnostic)
      </p>

      {/* Mandatory disclaimer (spec §4) */}
      <p className="text-xs text-amber-700">
        Writing style alone cannot confirm distress, deception, or incident
        severity. These cues may support human review but must not independently
        determine urgency.
      </p>

      <dl className="space-y-1 text-sm">
        <div className="flex gap-2">
          <dt className="text-xs font-medium text-gray-600 w-44 flex-shrink-0">
            Possible Distress
          </dt>
          <dd
            className={`text-sm ${DISTRESS_COLOR[signals.possibleDistress] ?? "text-gray-600"}`}
          >
            {signals.possibleDistress}
            {signals.possibleDistress === "NOT_INDICATED" && (
              <span className="text-xs text-gray-500 ml-1">
                — does not mean the reporter is calm or safe
              </span>
            )}
          </dd>
        </div>

        {/* "apparent" is mandatory in label (spec §4) */}
        <div className="flex gap-2">
          <dt className="text-xs font-medium text-gray-600 w-44 flex-shrink-0">
            Apparent Spelling Issues
          </dt>
          <dd className="text-sm text-gray-700">
            {signals.apparentSpellingIssueLevel}
          </dd>
        </div>

        <div className="flex gap-2">
          <dt className="text-xs font-medium text-gray-600 w-44 flex-shrink-0">
            Uppercase Emphasis
          </dt>
          <dd className="text-sm text-gray-700">{signals.uppercaseEmphasis}</dd>
        </div>

        <div className="flex gap-2">
          <dt className="text-xs font-medium text-gray-600 w-44 flex-shrink-0">
            Uppercase Letter Ratio
          </dt>
          <dd className="text-sm text-gray-700">
            {(signals.uppercaseLetterRatio * 100).toFixed(0)}%
          </dd>
        </div>

        {signals.explanation && (
          <div className="flex gap-2">
            <dt className="text-xs font-medium text-gray-600 w-44 flex-shrink-0">
              Explanation
            </dt>
            <dd className="text-sm text-gray-700">{signals.explanation}</dd>
          </div>
        )}
      </dl>

      {/* Classification explanation */}
      <div className="text-xs text-gray-500 pt-1 border-t border-amber-200">
        <span className="font-medium">NOT_INDICATED</span> — no positive distress
        cue observed.{" "}
        <span className="font-medium">POSSIBLE</span> — at least one notable cue
        (e.g. HELP in capitals).{" "}
        <span className="font-medium">ELEVATED</span> — multiple strong cues
        together (strong caps, many apparent mistakes, urgent wording).
      </div>
    </div>
  );
}

// Audit status display
type AuditRecordRow = {
  auditId: string;
  status: string;
  stellarTxHash: string | null;
  errorMessage: string | null;
} | undefined;

function AuditStatusDisplay({
  auditRecord,
}: {
  auditRecord: AuditRecordRow;
}) {
  if (!auditRecord) {
    return (
      <p className="text-sm text-gray-500">No audit record for this case.</p>
    );
  }

  const STATUS_COLOR: Record<string, string> = {
    PENDING: "text-yellow-700",
    ANCHORED: "text-green-700",
    FAILED: "text-red-700",
  };

  const canRetry =
    auditRecord.status === "PENDING" || auditRecord.status === "FAILED";

  return (
    <div className="space-y-1">
      <div className="flex gap-2 text-sm items-center">
        <span className="text-gray-600">Audit Status:</span>
        <span className={STATUS_COLOR[auditRecord.status] ?? "text-gray-700"}>
          {auditRecord.status}
        </span>
        {auditRecord.status === "ANCHORED" && (
          <Link
            href={`/verify/${auditRecord.auditId}`}
            className="text-xs text-green-700 hover:underline font-medium"
          >
            View Verification →
          </Link>
        )}
      </div>
      <div className="flex gap-2 text-sm">
        <span className="text-gray-600">Audit ID:</span>
        <Link
          href={`/verify/${auditRecord.auditId}`}
          className="font-mono text-blue-600 hover:underline text-xs"
        >
          {auditRecord.auditId}
        </Link>
      </div>
      {auditRecord.stellarTxHash && (
        <div className="flex gap-2 text-sm">
          <span className="text-gray-600">Stellar TX:</span>
          <span className="font-mono text-xs text-gray-700 break-all">
            {auditRecord.stellarTxHash}
          </span>
        </div>
      )}
      {auditRecord.errorMessage && (
        <p className="text-sm text-red-600">{auditRecord.errorMessage}</p>
      )}
      {canRetry && <AuditRetryButton auditId={auditRecord.auditId} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const authResult = await requireCoordinatorSession();
  if (!authResult.ok) {
    redirect("/login");
  }

  const { id } = await params;
  if (!isUuid(id)) {
    notFound();
  }

  const data = await loadCaseDetail(id);
  if (!data) {
    notFound();
  }

  const { caseRow, messages, latestAiAssessment, tasks, auditRecord, latestAiMessage } =
    data;

  const facts = (caseRow.facts as CaseFactsPatch) ?? {};
  const aiMetadata = latestAiMessage?.aiMetadata as Record<string, unknown> | null;

  // Derive AI suggested level for urgency form
  const aiSuggestedLevel = latestAiAssessment?.urgencyLevel ?? null;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/ops" className="text-sm text-blue-600 hover:underline">
            ← Case Queue
          </Link>
          <h1 className="text-lg font-semibold text-gray-900 mt-1">
            Case{" "}
            <span className="font-mono text-base">{caseRow.publicRef}</span>
          </h1>
          <div className="text-sm text-gray-500 mt-0.5">
            Status:{" "}
            <span className="font-medium text-gray-700">{caseRow.status}</span>
            {" · "}
            Chat:{" "}
            <span className="font-medium text-gray-700">{caseRow.chatMode}</span>
          </div>
        </div>
        <CaseControls caseId={caseRow.id} currentStatus={caseRow.status} />
      </div>

      {/* Section 1: Chat + controls */}
      <Section>
        <SectionHeader title="Chat" />

        {/* Transcript */}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {messages.length === 0 ? (
            <p className="text-sm text-gray-500">No messages yet.</p>
          ) : (
            messages.map((m) => (
              <MessageBubble
                key={m.id}
                senderType={m.senderType}
                body={m.body}
                createdAt={m.createdAt}
                displayName={
                  m.senderType === "COORDINATOR"
                    ? authResult.displayName
                    : undefined
                }
              />
            ))
          )}
        </div>

        {/* Take Over / Resume AI / Reply controls */}
        <ChatControls
          caseId={caseRow.id}
          chatMode={caseRow.chatMode as "AI" | "HUMAN"}
        />
      </Section>

      {/* Section 2: Facts + AI urgency + communication cues (separately labelled) */}
      <Section>
        <SectionHeader title="Facts and AI Urgency" />

        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Confirmed Facts
          </p>
          <FactsDisplay facts={facts} />
        </div>

        {latestAiAssessment && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              AI Urgency Breakdown
            </p>
            <AiUrgencyDisplay assessment={latestAiAssessment} />
          </div>
        )}

        {/* Communication cues — SEPARATELY displayed, never mixed with urgency factors */}
        {aiMetadata && (
          <div>
            <CommunicationCuesDisplay aiMetadata={aiMetadata} />
          </div>
        )}
      </Section>

      {/* Section 3: Human Final Urgency */}
      <Section>
        <SectionHeader title="Human Final Urgency" />
        <UrgencyForm
          caseId={caseRow.id}
          aiSuggestedLevel={aiSuggestedLevel}
          currentHumanUrgency={caseRow.humanUrgency}
        />
      </Section>

      {/* Section 4: Tasks + Audit */}
      <Section>
        <SectionHeader title="Tasks and Audit" />
        <TaskList caseId={caseRow.id} tasks={tasks} />
        <div className="pt-2 border-t border-gray-100">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Audit Record
          </p>
          <AuditStatusDisplay auditRecord={auditRecord} />
        </div>
      </Section>
    </div>
  );
}
