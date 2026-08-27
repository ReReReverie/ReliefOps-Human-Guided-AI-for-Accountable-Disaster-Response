/**
 * src/lib/db.ts — Drizzle database client.
 *
 * LOCAL_DEV=true  → uses node-postgres (pg) — works against any Postgres,
 *                   including the Docker container in docker-compose.yml.
 * Otherwise       → uses @neondatabase/serverless Pool (websocket-based,
 *                   required for Neon's connection pooler).
 *
 * Server-only; never import in browser code.
 */
import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

// The canonical DB type is the Neon driver's type — both drivers expose an
// identical Drizzle query API for our purposes, so we use one type for both.
type AppDB = ReturnType<typeof drizzleNeon<typeof schema>>;

let _db: AppDB | undefined;

export function getDb(): AppDB {
  if (!_db) {
    const url = process.env["DATABASE_URL"];
    if (!url) throw new Error("DATABASE_URL is not set");

    if (process.env["LOCAL_DEV"] === "true") {
      // Standard node-postgres — works with the Docker Postgres in docker-compose.yml
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { Pool } = require("pg");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { drizzle } = require("drizzle-orm/node-postgres");
      _db = drizzle(new Pool({ connectionString: url }), { schema }) as AppDB;
    } else {
      // Neon serverless websocket driver — required for Neon's connection pooler
      const { Pool } = require("@neondatabase/serverless");
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { drizzle } = require("drizzle-orm/neon-serverless");
      _db = drizzle(new Pool({ connectionString: url }), { schema }) as AppDB;
    }
  }
  return _db;
}

export { schema };
