import { defineConfig } from "drizzle-kit";

/**
 * drizzle.config.ts — Drizzle Kit configuration for migrations.
 * Uses DATABASE_URL_UNPOOLED (direct connection) so migrations run outside the
 * connection pool; falls back to DATABASE_URL for convenience.
 */
export default defineConfig({
  schema: "./src/lib/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url:
      process.env["DATABASE_URL_UNPOOLED"] ??
      process.env["DATABASE_URL"] ??
      "",
  },
});
