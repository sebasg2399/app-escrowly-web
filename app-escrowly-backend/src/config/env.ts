import { existsSync } from "node:fs";
import { z } from "zod";

// The app runtime does not read .env by itself (the Prisma CLI does).
// Load it when present so `pnpm dev` works locally; real env vars still win.
if (existsSync(".env")) {
  process.loadEnvFile(".env");
}

// Note: tests override DATABASE_URL to "escrowly_test" via env var.
const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url().or(z.string().startsWith("postgresql://")),
  JWT_SECRET: z.string().min(1),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  ACCESS_TOKEN_TTL: z.string().default("5m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  COOKIE_NAME: z.string().default("escrowly_refresh"),
});

export const env = envSchema.parse(process.env);

export type Env = z.infer<typeof envSchema>;
