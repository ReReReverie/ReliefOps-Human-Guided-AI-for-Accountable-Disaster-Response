import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Container/readiness probe. Do not include connection details in the
 * response: this endpoint is intentionally safe to expose on localhost.
 */
export async function GET() {
  try {
    await getDb().execute(sql`SELECT 1`);

    return Response.json(
      { status: "ok", service: "reliefops", database: "ok" },
      {
        status: 200,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error) {
    console.error("[health] database check failed", error);

    return Response.json(
      { status: "degraded", service: "reliefops", database: "unavailable" },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }
}
