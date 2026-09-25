import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fp from "fastify-plugin";
import pino, { LoggerOptions } from "pino";
import { randomUUID } from "node:crypto";
import { env } from "../config/env.js";

const SECRETS_TO_REDACT = [
  "password",
  "passwordHash",
  "token",
  "accessToken",
  "refreshToken",
  "authorization",
  "cookie",
  "jwtSecret",
  "jwt_secret",
  "DATABASE_URL",
];

function createLogger() {
  const opts: LoggerOptions = {
    level: env.NODE_ENV === "production" ? "info" : "debug",
    redact: {
      paths: SECRETS_TO_REDACT,
      censor: "[REDACTED]",
    },
    transport:
      env.NODE_ENV !== "production"
        ? { target: "pino-pretty", options: { colorize: true } }
        : undefined,
  };
  return pino(opts);
}

export const loggerPlugin = fp(
  async (app: FastifyInstance) => {
    const baseLogger = createLogger();

    // Attach a per-request correlation id
    app.addHook("onRequest", async (req: FastifyRequest, _reply: FastifyReply) => {
      const correlationId =
        (req.headers["x-correlation-id"] as string) ?? req.headers["x-request-id"] ?? randomUUID();

      req.id = correlationId;
      req.log = baseLogger.child({ correlationId, reqId: correlationId });
    });

    app.addHook("onResponse", async (req: FastifyRequest, reply: FastifyReply) => {
      req.log.info(
        {
          method: req.method,
          url: req.url,
          statusCode: reply.statusCode,
          responseTime: reply.elapsedTime,
        },
        "request completed",
      );
    });
  },
  { name: "logger-plugin" },
);
