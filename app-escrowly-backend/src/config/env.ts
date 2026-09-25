import { existsSync } from "node:fs";
import { z } from "zod";

// The app runtime does not read .env by itself (the Prisma CLI does).
// Load it when present so `pnpm dev` works locally; real env vars still win.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

// Tests run with NODE_ENV=test, where Stripe credentials are optional.
// In dev/prod the backend refuses to boot without them.
const isTest = process.env.NODE_ENV === "test";

const stripeSchema = z.object({
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_API_VERSION: z.string().default("2024-06-20"),
  STRIPE_CONNECT_REFRESH_URL: z.string().url().optional(),
  STRIPE_CONNECT_RETURN_URL: z.string().url().optional(),
});

const baseSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url().or(z.string().startsWith("postgresql://")),
  JWT_SECRET: z.string().min(1),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  ACCESS_TOKEN_TTL: z.string().default("5m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  COOKIE_NAME: z.string().default("escrowly_refresh"),
});

const envSchema = baseSchema.merge(stripeSchema);

const parsed = envSchema.parse(process.env);

function assertRequiredInNonTest(parsedEnv: z.infer<typeof envSchema>): void {
  if (isTest) return;
  const required = [
    "STRIPE_SECRET_KEY",
    "STRIPE_WEBHOOK_SECRET",
    "STRIPE_CONNECT_REFRESH_URL",
    "STRIPE_CONNECT_RETURN_URL",
  ] as const;
  for (const key of required) {
    if (!parsedEnv[key]) {
      throw new Error(
        `Missing required env var: ${key} (required when NODE_ENV !== "test")`,
      );
    }
  }
}

assertRequiredInNonTest(parsed);

export const env = parsed;
export type Env = z.infer<typeof envSchema>;
