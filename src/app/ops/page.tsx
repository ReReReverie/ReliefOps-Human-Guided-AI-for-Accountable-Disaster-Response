/**
 * /ops — coordinator case queue. Data and all mutations remain server-side;
 * this page only changes presentation and responsive layout.
 */
import Link from "next/link";
import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import {
  AlertCircle,
  ArrowRight,
  CheckCircle2,
  Clock3,
  Inbox,
  ListChecks,
  RefreshCw,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import { requireCoordinatorSession } from "@/lib/auth/coordinator";
import { getDb, schema } from "@/lib/db";
import { OverrideControl } from "@/features/cases/OverrideControl";
import { Alert, Badge, Card, StatCard, StatusBadge } from "@/components/ui";

export const dynamic = "force-dynamic";

type QueueCase = {
  id: string;
  publicRef: string;
  status: string;
  chatMode: "AI" | "HUMAN";
  humanUrgency: string | null;
  aiUrgency: string | null;
  createdAt: Date;
};

async function loadQueue(): Promise<QueueCase[]> {
  const db = getDb();
  const [cases, assessments] = await Promise.all([
    db.query.reliefCases.findMany({
      orderBy: [desc(schema.reliefCases.createdAt)],
    }),
    db.query.urgencyAssessments.findMany({
      where: eq(schema.urgencyAssessments.source, "AI"),
      orderBy: [desc(schema.urgencyAssessments.createdAt)],
    }),
  ]);
  const latestAiUrgency = new Map<string, string>();
  for (const assessment of assessments) {
    if (!latestAiUrgency.has(assessment.caseId)) {
      latestAiUrgency.set(assessment.caseId, assessment.urgencyLevel);
    }
  }
  return cases.map((item) => ({
    id: item.id,
    publicRef: item.publicRef,
    status: item.status,
    chatMode: item.chatMode as "AI" | "HUMAN",
    humanUrgency: item.humanUrgency,
    aiUrgency: latestAiUrgency.get(item.id) ?? null,
    createdAt: item.createdAt,
  }));
}

function formatAge(date: Date) {
  const diffMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60_000));
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const focusRing = "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-inset";

function UrgencyCell({ level }: { level: string | null }) {
  return level ? <StatusBadge status={level} /> : <span className="text-sm text-slate-500">Not assessed</span>;
}

function QueueTable({ cases }: { cases: QueueCase[] }) {
  return (
    <div className="ops-surface hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
      <table className="min-w-full text-left text-sm">
        <caption className="sr-only">Open ReliefOps case queue</caption>
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[0.12em] text-slate-500">
          <tr>
            <th scope="col" className="px-5 py-4 font-semibold">Reference</th>
            <th scope="col" className="px-5 py-4 font-semibold">Status</th>
            <th scope="col" className="px-5 py-4 font-semibold">AI urgency</th>
            <th scope="col" className="px-5 py-4 font-semibold">Human urgency</th>
            <th scope="col" className="px-5 py-4 font-semibold">Control</th>
            <th scope="col" className="px-5 py-4 font-semibold">Age</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {cases.map((item) => {
            const href = `/ops/cases/${item.id}`;
            return (
              <tr key={item.id} className="group transition hover:bg-slate-50 motion-reduce:transition-none">
                <td className="p-0 align-middle">
                  <Link href={href} className={`flex min-h-20 items-center gap-3 px-5 py-3 ${focusRing}`}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><Inbox aria-hidden="true" size={17} /></span>
                    <span className="min-w-0"><span className="block truncate font-mono text-sm font-semibold text-blue-800 group-hover:underline">{item.publicRef}</span><span className="mt-1 block text-xs text-slate-500">Open case record</span></span>
                  </Link>
                </td>
                <td className="p-0 align-middle"><Link href={href} className={`flex min-h-20 items-center px-5 py-3 ${focusRing}`}><StatusBadge status={item.status} /></Link></td>
                <td className="p-0 align-middle"><Link href={href} className={`flex min-h-20 items-center px-5 py-3 ${focusRing}`}><UrgencyCell level={item.aiUrgency} /></Link></td>
                <td className="p-0 align-middle"><Link href={href} className={`flex min-h-20 items-center px-5 py-3 ${focusRing}`}><UrgencyCell level={item.humanUrgency} /></Link></td>
                <td className="px-5 py-3 align-middle"><OverrideControl caseId={item.id} chatMode={item.chatMode} isClosed={item.status === "CLOSED"} redirectOnOverride /></td>
                <td className="p-0 align-middle"><Link href={href} className={`flex min-h-20 items-center gap-2 px-5 py-3 text-slate-600 ${focusRing}`}><Clock3 aria-hidden="true" size={15} /><span>{formatAge(item.createdAt)}</span></Link></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function QueueCards({ cases }: { cases: QueueCase[] }) {
  return (
    <div className="space-y-3 md:hidden">
      {cases.map((item) => (
        <article key={item.id} className="ops-surface rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <Link href={`/ops/cases/${item.id}`} className={`min-w-0 ${focusRing}`}>
              <span className="flex items-center gap-2"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700"><Inbox aria-hidden="true" size={17} /></span><span className="truncate font-mono text-sm font-semibold text-blue-800">{item.publicRef}</span></span>
              <span className="mt-2 block text-xs text-slate-500">Created {formatAge(item.createdAt)}</span>
            </Link>
            <StatusBadge status={item.status} />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-4">
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">AI urgency</dt><dd className="mt-1"><UrgencyCell level={item.aiUrgency} /></dd></div>
            <div><dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">Human urgency</dt><dd className="mt-1"><UrgencyCell level={item.humanUrgency} /></dd></div>
          </dl>
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4"><span className="flex items-center gap-2 text-xs text-slate-500"><Clock3 aria-hidden="true" size={14} />{formatAge(item.createdAt)}</span><OverrideControl caseId={item.id} chatMode={item.chatMode} isClosed={item.status === "CLOSED"} redirectOnOverride /></div>
        </article>
      ))}
    </div>
  );
}

export default async function OpsPage() {
  const authResult = await requireCoordinatorSession();
  if (!authResult.ok) redirect("/login");

  let cases: QueueCase[] = [];
  let loadError = false;
  try {
    cases = await loadQueue();
  } catch {
    loadError = true;
    console.error("[ops] case queue unavailable");
  }

  const openCount = cases.filter((item) => item.status !== "CLOSED").length;
  const humanCount = cases.filter((item) => item.chatMode === "HUMAN").length;
  const priorityCount = cases.filter((item) => ["CRITICAL", "HIGH"].includes(item.humanUrgency ?? item.aiUrgency ?? "")).length;
  const closedCount = cases.filter((item) => item.status === "CLOSED").length;

  return (
    <div className="min-h-[calc(100vh-8rem)] bg-transparent">
      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-700"><ShieldAlert aria-hidden="true" size={15} /> Coordinator workspace</div>
            <h1 className="mt-3 text-3xl font-bold tracking-tight text-[var(--ops-ink,#172033)] sm:text-4xl">Case Queue</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--ops-muted,#5c687b)]">A concise view of every synthetic report that needs triage, a human decision, or a final handoff.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3"><Badge tone="info" icon={UserRound}>Welcome, {authResult.displayName}</Badge><span className="flex items-center gap-2 text-xs text-[var(--ops-muted,#5c687b)]"><RefreshCw aria-hidden="true" size={14} />Live on refresh</span></div>
        </div>

        {loadError ? <Alert tone="danger" className="mt-7"><p className="font-semibold">Case queue unavailable.</p><p className="mt-1">The local database could not be reached. Retry the page when the coordinator service is ready.</p></Alert> : null}

        <section aria-label="Queue summary" className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Open cases" value={openCount} detail={openCount === 1 ? "One case needs attention" : `${openCount} cases need attention`} icon={Inbox} tone="info" />
          <StatCard label="Human handoffs" value={humanCount} detail="Cases currently with a coordinator" icon={UserRound} tone="success" />
          <StatCard label="Priority signals" value={priorityCount} detail="Critical or high AI/human urgency" icon={AlertCircle} tone={priorityCount > 0 ? "danger" : "neutral"} />
          <StatCard label="Closed records" value={closedCount} detail="Completed synthetic case workflows" icon={CheckCircle2} tone="neutral" />
        </section>

        <section aria-labelledby="queue-list-title" className="mt-8">
          <div className="ops-surface mb-4 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div><div className="flex items-center gap-2"><ListChecks aria-hidden="true" className="text-blue-700" size={19} /><h2 id="queue-list-title" className="text-base font-bold text-slate-950">Current queue</h2></div><p className="mt-1 text-sm text-slate-600">Select a reference to open the full case workspace.</p></div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600"><StatusBadge status="INTAKE" /><StatusBadge status="REVIEW" /><StatusBadge status="ACTIVE" /><span className="hidden text-slate-400 sm:inline">Status legend</span></div>
          </div>

          {cases.length === 0 && !loadError ? (
            <Card className="flex flex-col items-center justify-center px-6 py-14 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><Inbox aria-hidden="true" size={26} /></span>
              <h2 className="mt-5 text-lg font-bold text-slate-950">No cases in the queue</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-600">Start a synthetic report to create the first case, then return here to review the handoff.</p>
              <Link href="/report" className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 motion-reduce:transition-none">Open Reporter Intake <ArrowRight aria-hidden="true" size={16} /></Link>
            </Card>
          ) : cases.length > 0 ? (
            <><QueueTable cases={cases} /><QueueCards cases={cases} /></>
          ) : null}
        </section>
      </div>
    </div>
  );
}
