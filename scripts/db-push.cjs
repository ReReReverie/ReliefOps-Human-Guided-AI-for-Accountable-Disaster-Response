// scripts/db-push.cjs — loads .env.local then spawns drizzle-kit push
// Works on Windows without shell quoting issues.
const { config } = require("dotenv");
const { spawnSync } = require("child_process");
const { resolve } = require("path");

config({ path: resolve(__dirname, "../.env.local") });

const result = spawnSync(
  "node",
  ["node_modules/drizzle-kit/bin.cjs", "push"],
  { stdio: "inherit", env: process.env }
);
process.exit(result.status ?? 1);
