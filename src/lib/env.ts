import { z } from "zod";

/**
 * Environment validation — called at app startup.
 * All secrets stay server-side only; NEXT_PUBLIC_* variables are safe to expose.
 */

const secret32 = z.string().min(32, {
  message: "Must be at least 32 characters (≥ 32 bytes of random data)",
});

const serverSchema = z.object({
  // Database — required from Phase 2 onwards
  DATABASE_URL: z.string().url(),
  // DATABASE_URL_UNPOOLED is only used for migration runs; optional here.
  DATABASE_URL_UNPOOLED: z.string().url().optional().or(z.literal("")),

  // Neon Auth
  NEON_AUTH_BASE_URL: z.string().url().optional().or(z.literal("")),
  // Required from Phase 2 onwards.
  NEON_AUTH_COOKIE_SECRET: secret32,
  REPORTER_SESSION_PEPPER: secret32,

  // AI
  AI_PROVIDER: z.enum(["ollama", "mock"]).default("ollama"),
  AI_BASE_URL: z.string().url().default("http://127.0.0.1:11434/v1"),
  AI_MODEL: z.string().default("granite4.1:3b"),
  AI_CONTEXT_LENGTH: z.coerce.number().int().positive().default(4096),
  AI_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().default(600),
  AI_CONCURRENCY: z.coerce.number().int().positive().default(1),

  // Stellar
  STELLAR_NETWORK: z.enum(["testnet"]).default("testnet"),
  STELLAR_HORIZON_URL: z
    .string()
    .url()
    .default("https://horizon-testnet.stellar.org"),
  STELLAR_NETWORK_PASSPHRASE: z
    .string()
    .default("Test SDF Network ; September 2015"),
  STELLAR_AUDIT_PUBLIC_KEY: z.string().optional().or(z.literal("")),
  STELLAR_AUDIT_SECRET_KEY: z.string().optional().or(z.literal("")),
});

const clientSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url().default("http://localhost:3000"),
});

function parseEnv() {
  const serverResult = serverSchema.safeParse(process.env);
  if (!serverResult.success) {
    console.error(
      "❌  Invalid server environment variables:\n",
      serverResult.error.flatten().fieldErrors
    );
    throw new Error("Invalid server environment variables — see logs above.");
  }

  const clientResult = clientSchema.safeParse({
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  });
  if (!clientResult.success) {
    console.error(
      "❌  Invalid client environment variables:\n",
      clientResult.error.flatten().fieldErrors
    );
    throw new Error("Invalid client environment variables — see logs above.");
  }

  return { ...serverResult.data, ...clientResult.data };
}

// Singleton — parsed once and cached.
let _env: ReturnType<typeof parseEnv> | undefined;

export function getEnv() {
  if (!_env) {
    _env = parseEnv();
  }
  return _env;
}

// Convenient named export used in server-only modules.
export const env = new Proxy({} as ReturnType<typeof parseEnv>, {
  get(_target, prop) {
    return getEnv()[prop as keyof ReturnType<typeof parseEnv>];
  },
});
