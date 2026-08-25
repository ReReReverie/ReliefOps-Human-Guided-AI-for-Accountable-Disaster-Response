/**
 * drizzle/seed.ts — database seed script.
 *
 * Seeds one demonstration coordinator profile in the `profiles` table.
 * The matching Neon Auth user (email + password) must be created via the
 * Neon Auth console/dashboard; this script only creates the `profiles` row
 * that authorises that user as a COORDINATOR.
 *
 * Usage:
 *   DATABASE_URL=<url> npx tsx drizzle/seed.ts
 *
 * The COORDINATOR_USER_ID env var must match the Neon Auth user_id that was
 * created for the demonstration coordinator account.
 */
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import { profiles } from "../src/lib/schema";

async function seed() {
  const url = process.env["DATABASE_URL"];
  if (!url) {
    throw new Error("DATABASE_URL is required to run the seed script.");
  }

  const coordinatorUserId = process.env["COORDINATOR_USER_ID"];
  if (!coordinatorUserId) {
    throw new Error(
      "COORDINATOR_USER_ID is required — set it to the Neon Auth user_id for the demonstration coordinator."
    );
  }

  const coordinatorDisplayName =
    process.env["COORDINATOR_DISPLAY_NAME"] ?? "Demo Coordinator";

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema: { profiles } });

  console.log(
    `Seeding coordinator profile for user_id: ${coordinatorUserId} …`
  );

  await db
    .insert(profiles)
    .values({
      userId: coordinatorUserId,
      role: "COORDINATOR",
      displayName: coordinatorDisplayName,
    })
    .onConflictDoNothing();

  console.log("✅  Coordinator profile seeded.");
  await pool.end();
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
