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
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  Clock3,
  FileCheck2,
  FileText,
  UserRound,
} from "lucide-react";
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
import { Alert, Badge, Card, CardDescription, CardTitle, StatusBadge } from "@/components/ui";

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

  const [msgs, assessments, caseTasks, auditRecord] = await Promise.all([
    db.query.messages.findMany({
      where: eq(schema.messages.caseId, id),
      orderBy: [schema.messages.createdAt],
    }),
    db.query.urgencyAssessments.findMany({
      where: eq(schema.urgencyAssessments.caseId, id),
      orderBy: [desc(schema.urgencyAssessments.createdAt)],
    }),
    db.query.tasks.findMany({
      where: eq(schema.tasks.caseId, id),
      orderBy: [schema.tasks.position],
    }),
    db.query.auditRecords.findFirst({
      where: eq(schema.auditRecords.caseId, id),
    }),
  ]);

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
    <div className="mb-4 flex items-center gap-2 border-b border-slate-200 pb-3">
      <h2 className="text-base font-bold tracking-tight text-slate-950">{title}</h2>
    </div>
  );
}

function Section({ children }: { children: React.ReactNode }) {
  return (
    <section className="ops-surface rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      {children}
    </section>
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
    ? "border border-slate-200 bg-slate-50"
    : isCoordinator
      ? "border border-emerald-200 bg-emerald-50"
      : "border border-blue-200 bg-blue-50";

  return (
    <div className={`rounded-xl p-3 ${bubbleColor}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-bold text-slate-700">{label}</span>
        <span className="text-xs text-slate-500">
          {createdAt.toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      {/* Raw message: displayed exactly as stored — no HTML rendering */}
      <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6 text-slate-900">
        {body}
      </pre>
    </div>
  );
}

// Confirmed facts display
const REPORTER_FACT_KEYS = new Set([
  "reporterAlias",
  "reporterRelationship",
  "reporterLocationDescription",
]);

function FactsDisplay({ facts }: { facts: CaseFactsPatch }) {
  const entries = Object.entries(facts).filter(
    ([key, v]) =>
      !REPORTER_FACT_KEYS.has(key) &&
      v !== null &&
      v !== undefined &&
      v !== false
  );

  if (entries.length === 0) {
    return <p className="text-sm text-slate-500">No confirmed facts yet.</p>;
  }

  const LABELS: Record<string, string> = {
    incidentType: "Incident Type",
    locationDescription: "Synthetic / Coarse Location",
    victimName: "Victim Alias (Fictional Demo Only)",
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
    <dl className="grid gap-3 sm:grid-cols-2">
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
          <div key={key} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {LABELS[key] ?? key}
            </dt>
            <dd className="mt-1 break-words text-sm text-slate-900">{display}</dd>
          </div>
        );
      })}
    </dl>
  );
}

function readFirstStringFact(
  facts: CaseFactsPatch,
  keys: string[]
): string | null {
  const rawFacts = facts as Record<string, unknown>;
  for (const key of keys) {
    const value = rawFacts[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value;
    }
  }
  return null;
}

// Chatter metadata is presented separately from victim and incident facts so
// coordinators do not confuse the person communicating with the victim.
function ChatterDetailsDisplay({ facts }: { facts: CaseFactsPatch }) {
  const fields = [
    {
      label: "Chatter Alias (Fictional Demo Only)",
      value: readFirstStringFact(facts, ["reporterAlias"]),
    },
    {
      label: "Chatter Relationship",
      value: readFirstStringFact(facts, ["reporterRelationship"]),
    },
    {
      label: "Chatter Synthetic / Coarse Location",
      value: readFirstStringFact(facts, ["reporterLocationDescription"]),
    },
  ].filter((field): field is { label: string; value: string } => field.value !== null);

  if (fields.length === 0) return null;

  return (
    <div className="mt-5 border-t border-slate-200 pt-5">
      <p className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
        Chatter details
      </p>
      <p className="mb-4 text-xs leading-5 text-slate-500">
        The chatter is the person communicating with the coordinator. Use only
        the fictional alias and synthetic/coarse location provided for this demo.
      </p>
      <dl className="grid gap-3 sm:grid-cols-2">
        {fields.map((field) => (
          <div
            key={field.label}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
          >
            <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              {field.label}
            </dt>
            <dd className="mt-1 break-words text-sm text-slate-900">
              {field.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
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

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-slate-600">AI Suggested Urgency</span>
        <StatusBadge status={assessment.urgencyLevel} />
        {assessment.confidence && (
          <span className="text-xs text-slate-500">
            (confidence: {(parseFloat(assessment.confidence) * 100).toFixed(0)}%)
          </span>
        )}
      </div>

      {assessment.rationale && (
        <p className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 text-slate-700">{assessment.rationale}</p>
      )}

      {factors && factors.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Factors</p>
          <ul className="space-y-2">
            {factors.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <StatusBadge status={f.severity} className="mt-0.5 shrink-0" />
                <span className="leading-6 text-slate-700"><strong className="font-semibold text-slate-900">{f.name}:</strong> {f.explanation}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {missingInfo && missingInfo.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">Missing Information</p>
          <ul className="list-inside list-disc space-y-1">
            {missingInfo.map((m, i) => (
              <li key={i} className="text-sm leading-6 text-slate-600">
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

  return (
    <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      {/* Non-negotiable label from spec §4 */}
      <p className="flex items-center gap-2 text-sm font-bold text-amber-950">
        <AlertTriangle aria-hidden="true" size={16} />
        Possible Communication Distress (AI, non-diagnostic)
      </p>

      {/* Mandatory disclaimer (spec §4) */}
      <p className="text-xs leading-5 text-amber-900">
        Writing style alone cannot confirm distress, deception, or incident
        severity. These cues may support human review but must not independently
        determine urgency.
      </p>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-amber-900">
            Possible Distress
          </dt>
          <dd className="mt-1 text-sm font-semibold text-slate-900">
            <StatusBadge status={signals.possibleDistress} />
            {signals.possibleDistress === "NOT_INDICATED" && (
              <span className="ml-1 text-xs text-slate-600">
                — does not mean the reporter is calm or safe
              </span>
            )}
          </dd>
        </div>

        {/* "apparent" is mandatory in label (spec §4) */}
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-amber-900">
            Apparent Spelling Issues
          </dt>
          <dd className="mt-1 text-sm text-slate-800">
            {signals.apparentSpellingIssueLevel}
          </dd>
        </div>

        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-amber-900">
            Uppercase Emphasis
          </dt>
          <dd className="mt-1 text-sm text-slate-800">{signals.uppercaseEmphasis}</dd>
        </div>

        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-amber-900">
            Uppercase Letter Ratio
          </dt>
          <dd className="mt-1 text-sm text-slate-800">
            {(signals.uppercaseLetterRatio * 100).toFixed(0)}%
          </dd>
        </div>

        {signals.explanation && (
          <div className="sm:col-span-2">
            <dt className="text-xs font-semibold uppercase tracking-wide text-amber-900">
              Explanation
            </dt>
            <dd className="mt-1 text-sm leading-6 text-slate-800">{signals.explanation}</dd>
          </div>
        )}
      </dl>

      {/* Classification explanation */}
      <div className="border-t border-amber-200 pt-2 text-xs leading-5 text-amber-900">
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
    return <p className="text-sm text-slate-500">No audit record for this case.</p>;
  }

  const canRetry =
    auditRecord.status === "PENDING" || auditRecord.status === "FAILED";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold text-slate-600">Audit Status</span>
        <StatusBadge status={auditRecord.status} />
        {auditRecord.status === "ANCHORED" && (
          <Link
            href={`/verify/${auditRecord.auditId}`}
            className="inline-flex min-h-10 items-center gap-1 text-xs font-semibold text-emerald-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
          >
            View Verification <ArrowLeft aria-hidden="true" className="rotate-180" size={14} />
          </Link>
        )}
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        <span className="font-semibold text-slate-600">Audit ID:</span>
        <Link
          href={`/verify/${auditRecord.auditId}`}
          className="font-mono text-xs text-blue-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
        >
          {auditRecord.auditId}
        </Link>
      </div>
      {auditRecord.stellarTxHash && (
        <div className="flex flex-wrap gap-2 text-sm">
          <span className="font-semibold text-slate-600">Stellar TX:</span>
          <span className="break-all font-mono text-xs text-slate-700">
            {auditRecord.stellarTxHash}
          </span>
        </div>
      )}
      {auditRecord.errorMessage && (
        <Alert tone="danger" role="alert">{auditRecord.errorMessage}</Alert>
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
    <div className="min-h-[calc(100vh-8rem)] bg-transparent">
      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <nav aria-label="Breadcrumb" className="text-sm">
          <Link href="/ops" className="inline-flex min-h-10 items-center gap-2 font-semibold text-blue-700 hover:text-blue-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600">
            <ArrowLeft aria-hidden="true" size={16} /> Case Queue
          </Link>
        </nav>

        <div className="mt-5 flex flex-col gap-5 border-b border-slate-200 pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-700"><FileText aria-hidden="true" size={15} /> Case workspace</div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-[var(--ops-ink,#172033)] sm:text-4xl">Case <span className="font-mono text-2xl sm:text-3xl">{caseRow.publicRef}</span></h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <StatusBadge status={caseRow.status} />
              <Badge tone={caseRow.chatMode === "HUMAN" ? "success" : "info"} icon={caseRow.chatMode === "HUMAN" ? UserRound : Bot}>{caseRow.chatMode === "HUMAN" ? "Human coordinator" : "AI assistant"}</Badge>
              <span className="flex items-center gap-1.5 text-xs text-[var(--ops-muted,#5c687b)]"><Clock3 aria-hidden="true" size={14} /> Opened {caseRow.createdAt.toLocaleString()}</span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-[var(--ops-muted,#5c687b)]"><Activity aria-hidden="true" size={16} /> Human review stays in control.</div>
        </div>

        <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)] xl:items-start">
          <div className="space-y-6">
            <Section>
              <SectionHeader title="Conversation transcript" />
              <div className="max-h-[34rem] space-y-2 overflow-y-auto pr-1">
                {messages.length === 0 ? <p className="text-sm text-slate-500">No messages yet.</p> : messages.map((m) => <MessageBubble key={m.id} senderType={m.senderType} body={m.body} createdAt={m.createdAt} displayName={m.senderType === "COORDINATOR" ? authResult.displayName : undefined} />)}
              </div>
              <div className="mt-5 border-t border-slate-200 pt-5">
                <ChatControls caseId={caseRow.id} chatMode={caseRow.chatMode as "AI" | "HUMAN"} isClosed={caseRow.status === "CLOSED"} />
              </div>
            </Section>

            <Section>
              <SectionHeader title="Confirmed facts and AI signals" />
              <div>
                <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500"><CheckCircle2 aria-hidden="true" size={15} /> Confirmed facts</p>
                <p className="mb-4 text-xs leading-5 text-slate-500">Victim and chatter aliases are fictional demo labels. Incident and chatter locations are synthetic and coarse.</p>
                <FactsDisplay facts={facts} />
                <ChatterDetailsDisplay facts={facts} />
              </div>
              {latestAiAssessment ? <div className="mt-6 border-t border-slate-200 pt-5"><p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500"><Bot aria-hidden="true" size={15} /> AI urgency breakdown</p><AiUrgencyDisplay assessment={latestAiAssessment} /></div> : null}
              {aiMetadata ? <div className="mt-6 border-t border-slate-200 pt-5"><CommunicationCuesDisplay aiMetadata={aiMetadata} /></div> : null}
            </Section>
          </div>

          <aside className="space-y-6 xl:sticky xl:top-6">
            <Card className="border-blue-200 bg-blue-50/70 p-5 sm:p-6">
              <CardTitle>Case actions</CardTitle>
              <CardDescription className="mt-1">Status changes and audit tools are guarded by the coordinator session.</CardDescription>
              <div className="mt-5"><CaseControls caseId={caseRow.id} currentStatus={caseRow.status} auditId={auditRecord?.auditId ?? null} auditDbStatus={auditRecord?.status ?? "PENDING"} /></div>
            </Card>

            <Section>
              <SectionHeader title="Human Final Urgency" />
              <UrgencyForm caseId={caseRow.id} aiSuggestedLevel={aiSuggestedLevel} currentHumanUrgency={caseRow.humanUrgency} />
            </Section>

            <Section>
              <SectionHeader title="Tasks and audit" />
              <TaskList caseId={caseRow.id} tasks={tasks} />
              <div className="mt-6 border-t border-slate-200 pt-5">
                <p className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-slate-500"><FileCheck2 aria-hidden="true" size={15} /> Audit Record</p>
                <AuditStatusDisplay auditRecord={auditRecord} />
              </div>
            </Section>
          </aside>
        </div>
      </div>
    </div>
  );
}
