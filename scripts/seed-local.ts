/**
 * scripts/seed-local.ts — Seeds the local Postgres with a coordinator profile.
 *
 * Run after `pnpm drizzle-kit push` with the Docker DB running:
 *   pnpm seed:local
 *
 * Creates (or upserts) one row in the `profiles` table for the local
 * coordinator whose credentials are defined in .env.local:
 *   LOCAL_COORDINATOR_EMAIL
 *   LOCAL_COORDINATOR_PASSWORD
 *   LOCAL_COORDINATOR_NAME
 *
 * The user_id is fixed to "local-coordinator-001" so the seed is idempotent.
 */
import "dotenv/config";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { sql } from "drizzle-orm";
import * as schema from "../src/lib/schema";

const LOCAL_COORD_USER_ID = "local-coordinator-001";

async function main() {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    console.error("DATABASE_URL is not set. Make sure .env.local is present.");
    process.exit(1);
  }

  const displayName =
    process.env["LOCAL_COORDINATOR_NAME"] ?? "Local Coordinator";

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema });

  // Upsert — safe to run multiple times
  await db
    .insert(schema.profiles)
    .values({
      userId: LOCAL_COORD_USER_ID,
      role: "COORDINATOR",
      displayName,
    })
    .onConflictDoUpdate({
      target: schema.profiles.userId,
      set: { displayName, role: "COORDINATOR" },
    });

  console.log(`✅  Seeded coordinator profile:`);
  console.log(`    userId:      ${LOCAL_COORD_USER_ID}`);
  console.log(`    displayName: ${displayName}`);
  console.log(
    `    email:       ${process.env["LOCAL_COORDINATOR_EMAIL"] ?? "(not set)"}`
  );
  console.log(`\nYou can now log in at http://localhost:3000/login`);

  await pool.end();
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
