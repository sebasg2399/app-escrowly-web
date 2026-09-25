import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";

export type AppError = Error & {
  code?: string;
  statusCode?: number;
  details?: Record<string, string[]>;
};

const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  UNAUTHORIZED: "UNAUTHORIZED",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  RATE_LIMITED: "RATE_LIMITED",
  INTERNAL: "INTERNAL",
} as const;

function errorEnvelope(
  code: string,
  message: string,
  details?: Record<string, string[]>,
) {
  return { code, message, ...(details ? { details } : {}) };
}

export const errorHandlerPlugin = fp(
  async (app: FastifyInstance) => {
  // Fastify schema validation errors → 400 with field-level details
  app.setErrorHandler((error: FastifyError, _req, reply) => {
    // Fastify validation error (body/query/params/schema)
    const fe = error as FastifyError & { validation?: any[] };
    if (fe.validation) {
      const details: Record<string, string[]> = {};
      for (const v of fe.validation) {
        const field = (v.instancePath || "body").replace(/^\//, "") || "body";
        details[field] = details[field] || [];
        details[field].push(v.message ?? "invalid value");
      }
      return reply.code(400).send(
        errorEnvelope(
          ERROR_CODES.VALIDATION_ERROR,
          "Request validation failed",
          details,
        ),
      );
    }

    // Known application error with explicit code + status
    if (error.code && Object.values(ERROR_CODES).includes(error.code as any)) {
      return reply
        .code((error as AppError).statusCode ?? 500)
        .send(
          errorEnvelope(
            error.code,
            error.message,
            (error as AppError).details,
          ),
        );
    }

    // 409 / 429 from route handlers that set statusCode but not code
    if (error.statusCode === 409) {
      return reply
        .code(409)
        .send(errorEnvelope(ERROR_CODES.CONFLICT, error.message));
    }
    if (error.statusCode === 429) {
      return reply
        .code(429)
        .send(errorEnvelope(ERROR_CODES.RATE_LIMITED, error.message));
    }
    if (error.statusCode === 401) {
      return reply
        .code(401)
        .send(errorEnvelope(ERROR_CODES.UNAUTHORIZED, error.message));
    }

    // 404 — unknown route (set below via setNotFoundHandler)
    if (error.statusCode === 404) {
      return reply
        .code(404)
        .send(errorEnvelope(ERROR_CODES.NOT_FOUND, "Route not found"));
    }

    // Fallback — unexpected error
    app.log.error({ err: error }, "Unhandled error");
    return reply
      .code(500)
      .send(
        errorEnvelope(
          ERROR_CODES.INTERNAL,
          "An unexpected error occurred",
        ),
      );
  });

  // Unknown route → 404 envelope
  app.setNotFoundHandler((_req: FastifyRequest, reply: FastifyReply) => {
    reply
      .code(404)
      .send(errorEnvelope(ERROR_CODES.NOT_FOUND, "Route not found"));
  });
},
  { name: "error-handler-plugin" },
);
