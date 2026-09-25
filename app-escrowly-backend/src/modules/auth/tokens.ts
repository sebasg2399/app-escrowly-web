import { randomBytes, createHash } from "node:crypto";
import { FastifyInstance } from "fastify";

const REFRESH_BYTES = 32;

export function generateRefreshSecret(): string {
  return randomBytes(REFRESH_BYTES).toString("hex");
}

export function hashRefreshSecret(secret: string): string {
  return createHash("sha256").update(secret).digest("hex");
}

export function generateAccessJti(): string {
  return randomBytes(16).toString("hex");
}

export function signAccessToken(
  app: FastifyInstance,
  payload: { sub: string; role: string; jti: string },
  ttl: string,
): string {
  return app.jwt.sign(payload, { expiresIn: ttl });
}

export function verifyAccessToken(
  app: FastifyInstance,
  token: string,
): { sub: string; role: string; jti: string; exp: number } {
  return app.jwt.verify(token) as {
    sub: string;
    role: string;
    jti: string;
    exp: number;
  };
}

export function buildRefreshCookieValue(
  sessionId: string,
  secret: string,
): string {
  return `${sessionId}.${secret}`;
}

export function parseRefreshCookieValue(
  value: string,
): { sessionId: string; secret: string } | null {
  const parts = value.split(".");
  if (parts.length !== 2) return null;
  return { sessionId: parts[0], secret: parts[1] };
}
