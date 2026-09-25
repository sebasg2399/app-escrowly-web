import type { FastifyInstance } from "fastify";
import fp from "fastify-plugin";
import rateLimit from "@fastify/rate-limit";

export interface RateLimitPluginOptions {
  max: number;
  timeWindow: number | string;
}

export const rateLimitPlugin = fp(
  async (app: FastifyInstance, opts: RateLimitPluginOptions) => {
    await app.register(rateLimit, {
      max: opts.max ?? 10,
      timeWindow: opts.timeWindow ?? "1 minute",
      errorResponseBuilder: (_req, context) => ({
        code: "RATE_LIMITED",
        message: `Rate limit exceeded, retry in ${context.after}`,
        statusCode: 429,
      }),
      addHeadersOnExceeding: {},
      addHeaders: {},
    });
  },
  { name: "rate-limit-plugin", dependencies: ["error-handler-plugin"] },
);
