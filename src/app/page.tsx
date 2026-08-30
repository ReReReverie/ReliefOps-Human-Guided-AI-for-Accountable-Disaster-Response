import Link from "next/link";
import { desc } from "drizzle-orm";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  ClipboardCheck,
  Database,
  FileCheck2,
  MessageSquareText,
  Radio,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { Alert, Badge, Card, CardDescription, CardTitle, StatusBadge } from "@/components/ui";
import { getDb, schema } from "@/lib/db";
import { isLocalAuthBypassEnabled } from "@/lib/auth/local-config";

export const dynamic = "force-dynamic";

type DemoCase = {
  id: string;
  publicRef: string;
  status: string;
  createdAt: Date;
};

type DemoAudit = {
  auditId: string;
  status: string;
  firstMessageAt: Date;
};

type DemoSnapshot = {
  enabled: boolean;
  cases: DemoCase[];
  audits: DemoAudit[];
  status: "ready" | "degraded" | "unavailable";
};

const EMPTY_SNAPSHOT: DemoSnapshot = {
  enabled: false,
  cases: [],
  audits: [],
  status: "unavailable",
};

/** Public landing data is safe metadata only, and is optional in local demo mode. */
async function loadDemoSnapshot(): Promise<DemoSnapshot> {
  if (!isLocalAuthBypassEnabled()) return EMPTY_SNAPSHOT;

  try {
    const db = getDb();
    const [caseResult, auditResult] = await Promise.allSettled([
      db.query.reliefCases.findMany({
        columns: { id: true, publicRef: true, status: true, createdAt: true },
        orderBy: [desc(schema.reliefCases.createdAt)],
        limit: 4,
      }),
      db.query.auditRecords.findMany({
        columns: { auditId: true, status: true, firstMessageAt: true },
        orderBy: [desc(schema.auditRecords.firstMessageAt)],
        limit: 4,
      }),
    ]);

    const cases = caseResult.status === "fulfilled" ? caseResult.value : [];
    const audits = auditResult.status === "fulfilled" ? auditResult.value : [];
    if (caseResult.status === "rejected" || auditResult.status === "rejected") {
      console.warn("[home] some local demo activity could not be loaded");
    }
    return {
      enabled: true,
      cases,
      audits,
      status:
        caseResult.status === "rejected" || auditResult.status === "rejected"
          ? "degraded"
          : "ready",
    };
  } catch {
    return { enabled: true, cases: [], audits: [], status: "unavailable" };
  }
}

function formatDemoDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

const focusRing =
  "focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2";

export default async function RootPage() {
  const snapshot = await loadDemoSnapshot();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto max-w-[1440px] px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <section
          aria-labelledby="home-title"
          className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm"
        >
          <div aria-hidden="true" className="pointer-events-none absolute -right-36 -top-40 h-[28rem] w-[28rem] rounded-full bg-blue-100/70 blur-3xl" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-40 left-1/3 h-72 w-72 rounded-full bg-cyan-100/60 blur-3xl" />

          <div className="relative grid gap-10 px-6 py-10 sm:px-10 sm:py-14 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:px-16 lg:py-16">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-blue-700">
                <span className="inline-flex items-center gap-1.5"><Radio aria-hidden="true" size={14} /> ReliefOps</span>
                <span aria-hidden="true" className="text-slate-300">/</span>
                <span className="text-slate-500">Demo control center</span>
                {snapshot.enabled ? <Badge tone="success" icon={Database}>Local demo mode</Badge> : null}
              </div>

              <h1 id="home-title" className="mt-6 max-w-3xl text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
                Coordinate the next right action.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
                ReliefOps brings a reporter&apos;s first message, AI-supported triage,
                human decisions, and a verifiable audit trail into one clear workflow.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/report" className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-800 ${focusRing} motion-reduce:transition-none`}>
                  <MessageSquareText aria-hidden="true" size={18} />
                  Report Incident
                  <ArrowRight aria-hidden="true" size={17} />
                </Link>
                <Link href="/ops" className={`inline-flex min-h-12 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:border-blue-400 hover:bg-blue-50 ${focusRing} motion-reduce:transition-none`}>
                  <ClipboardCheck aria-hidden="true" size={18} />
                  Operator Dashboard
                </Link>
              </div>

              <p className="mt-5 flex items-start gap-2 text-xs leading-5 text-slate-500">
                <TriangleAlert aria-hidden="true" className="mt-0.5 shrink-0 text-amber-600" size={14} />
                <span><strong className="font-semibold text-slate-700">Synthetic demonstration only.</strong> ReliefOps is not an emergency service. Never enter real personal information.</span>
              </p>
            </div>

            <div className="relative rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-xl shadow-slate-900/10 sm:p-6">
              <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.15em] text-blue-300">Operations snapshot</p>
                  <p className="mt-1 text-lg font-semibold">A calm view of a noisy moment</p>
                </div>
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-blue-200"><Activity aria-hidden="true" size={20} /></span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-white/10 p-4"><p className="text-2xl font-semibold">01</p><p className="mt-1 text-xs text-slate-300">Reporter intake</p></div>
                <div className="rounded-xl bg-white/10 p-4"><p className="text-2xl font-semibold">02</p><p className="mt-1 text-xs text-slate-300">Human review</p></div>
                <div className="rounded-xl bg-white/10 p-4"><p className="text-2xl font-semibold">03</p><p className="mt-1 text-xs text-slate-300">Audit verify</p></div>
                <div className="rounded-xl bg-blue-700 p-4"><p className="text-2xl font-semibold">24/7</p><p className="mt-1 text-xs text-blue-100">Designed for clarity</p></div>
              </div>
              <div className="mt-5 flex items-center gap-2 text-xs text-slate-300"><CheckCircle2 aria-hidden="true" className="text-emerald-300" size={15} /> Human decisions stay visible.</div>
            </div>
          </div>
        </section>

        <section aria-labelledby="workflow-title" className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">The demo loop</p>
              <h2 id="workflow-title" className="mt-2 text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl">One narrative, three accountable steps.</h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-slate-500">Use the same handoff language from the first report through the final verification record.</p>
          </div>

          <ol className="mt-6 grid gap-4 md:grid-cols-3">
            {[
              { icon: MessageSquareText, step: "01 / Intake", title: "Create a case", text: "Use fictional details to open a report and let the assistant structure the first response.", href: "/report", link: "Start a report" },
              { icon: ClipboardCheck, step: "02 / Review", title: "Make the human call", text: "Compare AI signals with confirmed facts, tasks, and the coordinator's final urgency decision.", href: "/ops", link: "Review the queue" },
              { icon: ShieldCheck, step: "03 / Verify", title: "Prove the record", text: "Open the verification view to show how an audit record can be checked independently.", href: "/ops", link: "View the workflow" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.step} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Icon aria-hidden="true" size={20} /></span>
                  <p className="mt-5 text-xs font-bold uppercase tracking-[0.15em] text-slate-500">{item.step}</p>
                  <h3 className="mt-2 text-lg font-bold text-slate-950">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.text}</p>
                  <Link href={item.href} className={`mt-5 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-blue-700 hover:text-blue-900 ${focusRing}`}>
                    {item.link}<ArrowRight aria-hidden="true" size={15} />
                  </Link>
                </li>
              );
            })}
          </ol>
        </section>

        <section aria-labelledby="activity-title" className="mt-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-700">Safe local activity</p>
              <h2 id="activity-title" className="mt-2 text-2xl font-bold tracking-tight text-slate-950">See the latest demo signals.</h2>
            </div>
            <Badge tone={snapshot.status === "ready" ? "success" : snapshot.status === "degraded" ? "warning" : "neutral"} icon={snapshot.status === "ready" ? CheckCircle2 : TriangleAlert}>
              {snapshot.status === "ready" ? "Activity ready" : snapshot.status === "degraded" ? "Activity partially available" : "Activity unavailable"}
            </Badge>
          </div>

          {!snapshot.enabled ? (
            <Alert tone="info" className="mt-6">
              <p className="font-semibold">Local activity is available in the guided demo environment.</p>
              <p className="mt-1">Open Reporter Intake or the Operator Dashboard to walk through the workflow.</p>
            </Alert>
          ) : snapshot.status === "unavailable" ? (
            <Alert tone="warning" className="mt-6">
              <p className="font-semibold">Activity data is temporarily unavailable.</p>
              <p className="mt-1">The two workflow entry points remain available while the local database reconnects.</p>
            </Alert>
          ) : (
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <Card className="p-5 sm:p-6">
                <div className="flex items-center justify-between gap-4">
                  <div><CardTitle>Recent cases</CardTitle><CardDescription className="mt-1">Safe metadata only — no reporter content.</CardDescription></div>
                  <MessageSquareText aria-hidden="true" className="text-blue-700" size={20} />
                </div>
                {snapshot.cases.length === 0 ? (
                  <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                    <p className="font-semibold text-slate-800">No demo cases yet.</p>
                    <p className="mt-1">Open Reporter Intake to create the first synthetic case.</p>
                    <Link href="/report" className={`mt-4 inline-flex items-center gap-2 font-semibold text-blue-700 ${focusRing}`}>Open intake <ArrowRight aria-hidden="true" size={15} /></Link>
                  </div>
                ) : (
                  <ul className="mt-5 divide-y divide-slate-100">
                    {snapshot.cases.map((item) => (
                      <li key={item.id}>
                        <Link href={`/ops/cases/${item.id}`} className={`flex min-h-16 items-center justify-between gap-4 py-3 hover:bg-slate-50 ${focusRing}`}>
                          <span className="min-w-0"><span className="block truncate font-mono text-sm font-semibold text-slate-900">{item.publicRef}</span><span className="mt-1 block text-xs text-slate-500">Created {formatDemoDate(item.createdAt)}</span></span>
                          <StatusBadge status={item.status} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card className="p-5 sm:p-6">
                <div className="flex items-center justify-between gap-4">
                  <div><CardTitle>Audit verification</CardTitle><CardDescription className="mt-1">Integrity records from the local demo.</CardDescription></div>
                  <FileCheck2 aria-hidden="true" className="text-emerald-700" size={20} />
                </div>
                {snapshot.audits.length === 0 ? (
                  <div className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm text-slate-600">
                    <p className="font-semibold text-slate-800">No audit records yet.</p>
                    <p className="mt-1">Create a report, then open its case detail page to view verification.</p>
                  </div>
                ) : (
                  <ul className="mt-5 divide-y divide-slate-100">
                    {snapshot.audits.map((item) => (
                      <li key={item.auditId}>
                        <Link href={`/verify/${item.auditId}`} className={`flex min-h-16 items-center justify-between gap-4 py-3 hover:bg-slate-50 ${focusRing}`}>
                          <span className="min-w-0"><span className="block truncate text-sm font-semibold text-slate-900">Verify chat-start record</span><span className="mt-1 block text-xs text-slate-500">Recorded {formatDemoDate(item.firstMessageAt)}</span></span>
                          <StatusBadge status={item.status} />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          )}

          {snapshot.status === "degraded" ? <Alert tone="warning" className="mt-4"><p>Some local activity could not be loaded. Results may be incomplete; no reporter content is exposed here.</p></Alert> : null}
        </section>

        <footer className="mt-12 border-t border-slate-200 pt-5 text-xs leading-5 text-slate-500">
          ReliefOps is a prototype for demonstration with synthetic data only; it is not an emergency service.
        </footer>
      </div>
    </div>
  );
}
