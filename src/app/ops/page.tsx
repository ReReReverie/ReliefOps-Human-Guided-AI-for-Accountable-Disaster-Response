/**
 * /ops — Case queue page.
 *
 * Protected in production. Local development may explicitly use the seeded
 * coordinator identity without a login session.
 * Shows all relief cases with: reference, status, AI-suggested urgency,
 * human urgency, and age (created_at relative).
 *
 * Server Component — data loaded here, no client state needed.
 */
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireCoordinatorSession } from "@/lib/auth/coordinator";
import { getDb, schema } from "@/lib/db";
import { eq, desc } from "drizzle-orm";

export const dynamic = "force-dynamic";

async function loadQueue() {
  const db = getDb();

  // Load all cases ordered by newest first
  const cases = await db.query.reliefCases.findMany({
    orderBy: [desc(schema.reliefCases.createdAt)],
  });

  // Load latest AI urgency assessment per case
  const allAiAssessments = await db.query.urgencyAssessments.findMany({
    where: eq(schema.urgencyAssessments.source, "AI"),
    orderBy: [desc(schema.urgencyAssessments.createdAt)],
  });

  // Build map: caseId → latest AI urgency level
  const latestAiUrgency = new Map<string, string>();
  for (const a of allAiAssessments) {
    if (!latestAiUrgency.has(a.caseId)) {
      latestAiUrgency.set(a.caseId, a.urgencyLevel);
    }
  }

  return cases.map((c) => ({
    id: c.id,
    publicRef: c.publicRef,
    status: c.status,
    humanUrgency: c.humanUrgency,
    aiUrgency: latestAiUrgency.get(c.id) ?? null,
    createdAt: c.createdAt,
  }));
}

function formatAge(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

const STATUS_COLOR: Record<string, string> = {
  INTAKE: "bg-yellow-100 text-yellow-800",
  REVIEW: "bg-blue-100 text-blue-800",
  ACTIVE: "bg-green-100 text-green-800",
  CLOSED: "bg-gray-100 text-gray-600",
};

const URGENCY_COLOR: Record<string, string> = {
  CRITICAL: "text-red-700 font-semibold",
  HIGH: "text-orange-600 font-semibold",
  MEDIUM: "text-yellow-700",
  LOW: "text-gray-600",
};

export default async function OpsPage() {
  const authResult = await requireCoordinatorSession();
  if (!authResult.ok) {
    redirect("/login");
  }

  const cases = await loadQueue();

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Case Queue</h1>
        <span className="text-sm text-gray-500">
          Welcome, {authResult.displayName}
        </span>
      </div>

      {cases.length === 0 ? (
        <p className="text-gray-500 text-sm">No cases yet.</p>
      ) : (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full text-sm divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Reference
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Status
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  AI Suggested Urgency
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Human Final Urgency
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">
                  Age
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {cases.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/ops/cases/${c.id}`}
                      className="font-mono text-blue-600 hover:underline"
                    >
                      {c.publicRef}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLOR[c.status] ?? "bg-gray-100 text-gray-600"}`}
                    >
                      {c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.aiUrgency ? (
                      <span
                        className={
                          URGENCY_COLOR[c.aiUrgency] ?? "text-gray-600"
                        }
                      >
                        {c.aiUrgency}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {c.humanUrgency ? (
                      <span
                        className={
                          URGENCY_COLOR[c.humanUrgency] ?? "text-gray-600"
                        }
                      >
                        {c.humanUrgency}
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {formatAge(c.createdAt)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
