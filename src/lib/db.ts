/**
 * src/lib/db.ts — Drizzle database client using @neondatabase/serverless.
 * Server-only; never import in browser code.
 */
import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool } from "@neondatabase/serverless";
import * as schema from "./schema";

// Lazily instantiated so tests that don't need a DB can import other modules
// without a DATABASE_URL present.
let _db: ReturnType<typeof drizzle<typeof schema>> | undefined;

export function getDb() {
  if (!_db) {
    const url = process.env["DATABASE_URL"];
    if (!url) {
      throw new Error("DATABASE_URL is not set");
    }
    const pool = new Pool({ connectionString: url });
    _db = drizzle(pool, { schema });
  }
  return _db;
}

export { schema };
