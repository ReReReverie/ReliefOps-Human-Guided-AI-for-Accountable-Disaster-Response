import Link from "next/link";
import { desc } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { isLocalAuthBypassEnabled } from "@/lib/auth/local-config";

// The page reads local-only demo activity, so never prerender identifiers into
// a static artifact when the local auth bypass is enabled.
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

/**
 * Only local demo mode may read identifiers from the database. The public
 * landing page never exposes reporter content, session material, nonces, or
 * secrets, and remains useful when the database is empty or unavailable.
 */
async function loadDemoSnapshot(): Promise<DemoSnapshot> {
  if (!isLocalAuthBypassEnabled()) {
    return EMPTY_SNAPSHOT;
  }

  try {
    const db = getDb();
    const [caseResult, auditResult] = await Promise.allSettled([
      db.query.reliefCases.findMany({
        columns: {
          id: true,
          publicRef: true,
          status: true,
          createdAt: true,
        },
        orderBy: [desc(schema.reliefCases.createdAt)],
        limit: 4,
      }),
      db.query.auditRecords.findMany({
        columns: {
          auditId: true,
          status: true,
          firstMessageAt: true,
        },
        orderBy: [desc(schema.auditRecords.firstMessageAt)],
        limit: 4,
      }),
    ]);

    const cases = caseResult.status === "fulfilled" ? caseResult.value : [];
    const audits = auditResult.status === "fulfilled" ? auditResult.value : [];
    const queryFailed =
      caseResult.status === "rejected" || auditResult.status === "rejected";

    // Keep connection/query details out of the rendered page and server logs.
    if (queryFailed) {
      console.error("[home] some local demo activity could not be loaded");
    }

    return {
      enabled: true,
      cases,
      audits,
      status: queryFailed ? "degraded" : "ready",
    };
  } catch {
    // A missing DATABASE_URL or unavailable local container should not block
    // the demo landing page or its two primary entry points.
    return {
      enabled: true,
      cases: [],
      audits: [],
      status: "unavailable",
    };
  }
}

function formatDemoDate(date: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

const CASE_STATUS_STYLES: Record<string, string> = {
  INTAKE: "bg-amber-100 text-amber-800",
  REVIEW: "bg-blue-100 text-blue-800",
  ACTIVE: "bg-emerald-100 text-emerald-800",
  CLOSED: "bg-slate-100 text-slate-600",
};

const AUDIT_STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800",
  ANCHORED: "bg-emerald-100 text-emerald-800",
  FAILED: "bg-rose-100 text-rose-800",
};

export default async function RootPage() {
  const snapshot = await loadDemoSnapshot();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <section
          aria-labelledby="home-title"
          className="relative overflow-hidden rounded-3xl border border-slate-200 bg-white px-6 py-10 shadow-sm sm:px-10 sm:py-14"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-blue-100/70 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-cyan-100/60 blur-3xl"
          />

          <div className="relative max-w-3xl">
            <div className="mb-5 flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
              <span>ReliefOps</span>
              <span aria-hidden="true" className="text-slate-300">
                /
              </span>
              <span className="text-slate-500">Demo control center</span>
              {snapshot.enabled && (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-[0.68rem] tracking-[0.12em] text-emerald-700 ring-1 ring-inset ring-emerald-200">
                  Local demo mode
                </span>
              )}
            </div>

            <h1
              id="home-title"
              className="max-w-2xl text-4xl font-semibold tracking-tight text-slate-950 sm:text-5xl"
            >
              One workspace for every handoff.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
              Run the complete ReliefOps story from one place: collect a
              simulated report, review it as a coordinator, and verify the
              audit trail when the case is ready.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <Link
                href="/report"
                className="group rounded-2xl bg-blue-700 p-5 text-white shadow-lg shadow-blue-700/15 transition hover:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-lg font-semibold">
                    01
                  </span>
                  <span
                    aria-hidden="true"
                    className="text-xl transition-transform group-hover:translate-x-1"
                  >
                    →
                  </span>
                </div>
                <h2 className="mt-8 text-xl font-semibold">Reporter intake</h2>
                <p className="mt-2 text-sm leading-6 text-blue-100">
                  Start a synthetic incident report and see the AI handoff in
                  action.
                </p>
                <span className="mt-5 inline-flex text-sm font-semibold text-white">
                  Open intake
                </span>
              </Link>

              <Link
                href="/ops"
                className="group rounded-2xl border border-slate-200 bg-slate-950 p-5 text-white shadow-lg shadow-slate-950/10 transition hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-700 focus:ring-offset-2"
              >
                <div className="flex items-start justify-between gap-4">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-lg font-semibold">
                    02
                  </span>
                  <span
                    aria-hidden="true"
                    className="text-xl transition-transform group-hover:translate-x-1"
                  >
                    →
                  </span>
                </div>
                <h2 className="mt-8 text-xl font-semibold">Operator queue</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  Review urgency signals, take ownership, and move the case
                  toward resolution.
                </p>
                <span className="mt-5 inline-flex text-sm font-semibold text-white">
                  Open queue
                </span>
              </Link>
            </div>
          </div>
        </section>

        <section aria-labelledby="workflow-title" className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                The demo loop
              </p>
              <h2
                id="workflow-title"
                className="mt-2 text-2xl font-semibold tracking-tight text-slate-950"
              >
                Three steps, one clear narrative.
              </h2>
            </div>
            <p className="max-w-md text-sm leading-6 text-slate-500">
              Each step is designed to be easy to explain while you walk an
              audience through the product.
            </p>
          </div>

          <ol className="mt-5 grid gap-4 md:grid-cols-3">
            <li className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Step 01
              </span>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">
                Create a case
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Use fictional details in Reporter Intake to create a case and
                let the simulated assistant structure the first response.
              </p>
              <Link
                href="/report"
                className="mt-5 inline-flex items-center text-sm font-semibold text-blue-700 hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
              >
                Start a report <span aria-hidden="true" className="ml-2">→</span>
              </Link>
            </li>

            <li className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Step 02
              </span>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">
                Make the human call
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Open the operator queue to compare AI suggestions with human
                review, tasks, and the final urgency decision.
              </p>
              <Link
                href="/ops"
                className="mt-5 inline-flex items-center text-sm font-semibold text-blue-700 hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
              >
                Review the queue <span aria-hidden="true" className="ml-2">→</span>
              </Link>
            </li>

            <li className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Step 03
              </span>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">
                Verify the record
              </h3>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Open the audit verification link from a case detail page to
                show how the event record can be checked independently.
              </p>
              <Link
                href="/ops"
                className="mt-5 inline-flex items-center text-sm font-semibold text-blue-700 hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
              >
                Find an audit record <span aria-hidden="true" className="ml-2">→</span>
              </Link>
            </li>
          </ol>
        </section>

        {snapshot.enabled ? (
          <section aria-labelledby="activity-title" className="mt-10">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">
                  Local demo activity
                </p>
                <h2
                  id="activity-title"
                  className="mt-2 text-2xl font-semibold tracking-tight text-slate-950"
                >
                  Pick up where the last run left off.
                </h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-slate-500">
                Only non-sensitive case references, statuses, and audit links
                are shown here for local demonstration use.
              </p>
            </div>

            {snapshot.status === "degraded" && (
              <p
                role="status"
                className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
              >
                Some recent activity could not be loaded. The intake and queue
                links above are still available.
              </p>
            )}

            {snapshot.status === "unavailable" && (
              <p
                role="status"
                className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600"
              >
                Recent activity is unavailable right now. Start a new report
                to continue the demo.
              </p>
            )}

            {snapshot.status !== "unavailable" && (
              <div className="mt-5 grid gap-5 lg:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="font-semibold text-slate-900">Recent cases</h3>
                    <Link
                      href="/ops"
                      className="text-sm font-semibold text-blue-700 hover:text-blue-900 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
                    >
                      View queue
                    </Link>
                  </div>

                  {snapshot.cases.length === 0 ? (
                    <p className="mt-5 text-sm leading-6 text-slate-500">
                      No demo cases yet. Open Reporter Intake to create the
                      first one.
                    </p>
                  ) : (
                    <ul className="mt-4 divide-y divide-slate-100">
                      {snapshot.cases.map((item) => (
                        <li key={item.id}>
                          <Link
                            href={`/ops/cases/${item.id}`}
                            className="flex items-center justify-between gap-4 py-3 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-600"
                          >
                            <span className="min-w-0">
                              <span className="block truncate font-mono text-sm font-semibold text-slate-900">
                                {item.publicRef}
                              </span>
                              <span className="mt-1 block text-xs text-slate-500">
                                Created {formatDemoDate(item.createdAt)}
                              </span>
                            </span>
                            <span
                              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${CASE_STATUS_STYLES[item.status] ?? "bg-slate-100 text-slate-600"}`}
                            >
                              {item.status}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between gap-4">
                    <h3 className="font-semibold text-slate-900">
                      Audit verification
                    </h3>
                    <span className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                      Latest records
                    </span>
                  </div>

                  {snapshot.audits.length === 0 ? (
                    <p className="mt-5 text-sm leading-6 text-slate-500">
                      No audit records yet. Create a report, then open its case
                      detail page to view verification.
                    </p>
                  ) : (
                    <ul className="mt-4 divide-y divide-slate-100">
                      {snapshot.audits.map((item) => (
                        <li key={item.auditId}>
                          <Link
                            href={`/verify/${item.auditId}`}
                            className="flex items-center justify-between gap-4 py-3 transition hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-600"
                          >
                            <span className="min-w-0">
                              <span className="block text-sm font-semibold text-slate-900">
                                Verify chat-start record
                              </span>
                              <span className="mt-1 block text-xs text-slate-500">
                                Recorded {formatDemoDate(item.firstMessageAt)}
                              </span>
                            </span>
                            <span
                              className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${AUDIT_STATUS_STYLES[item.status] ?? "bg-slate-100 text-slate-600"}`}
                            >
                              {item.status}
                            </span>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </section>
        ) : (
          <section
            aria-labelledby="demo-note-title"
            className="mt-10 rounded-2xl border border-blue-100 bg-blue-50/70 p-5 sm:p-6"
          >
            <h2 id="demo-note-title" className="font-semibold text-slate-900">
              Ready for a guided demo
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Use the two entry points above to walk through the workflow. In
              local demo mode, this page can also show the latest safe activity
              shortcuts without exposing reporter content.
            </p>
          </section>
        )}

        <footer className="mt-10 border-t border-slate-200 pt-5 text-xs leading-5 text-slate-500">
          ReliefOps is a prototype for demonstration with synthetic data only;
          it is not an emergency service.
        </footer>
      </div>
    </div>
  );
}
