import type { FastifyInstance, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { env } from "../config/env.js";

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

/**
 * Stripe webhook receiver. Registers an encapsulated content-type parser
 * for `application/json` so the raw buffer is available for signature
 * verification; JSON.parse happens for normal consumer readability.
 *
 * Phase 2 ships the parser + route stub. Phase 5 will replace the handler
 * with the actual `payment_intent.*` / `account.updated` / `transfer.*`
 * dispatching logic.
 */
export const stripeWebhooksPlugin = fp(
  async (app: FastifyInstance) => {
    app.addContentTypeParser(
      "application/json",
      { parseAs: "buffer" },
      (_req: FastifyRequest, body: Buffer, done) => {
        try {
          const raw = body.length === 0 ? Buffer.from("") : body;
          (_req as FastifyRequest).rawBody = raw;
          if (raw.length === 0) {
            done(null, undefined);
            return;
          }
          done(null, JSON.parse(raw.toString("utf8")));
        } catch (err) {
          const e = err as Error & { statusCode?: number };
          const bad = new Error("Invalid JSON body") as Error & {
            statusCode: number;
            code: string;
          };
          bad.statusCode = 400;
          bad.code = "VALIDATION_ERROR";
          bad.message = e.message || "Invalid JSON body";
          done(bad);
        }
      },
    );

    app.post(
      "/webhooks/stripe",
      {
        config: { rawBody: true },
      },
      async (request, reply) => {
        if (!env.STRIPE_WEBHOOK_SECRET) {
          reply.code(501);
          return { error: "Webhook handler not implemented" };
        }
        reply.code(501);
        return { error: "Webhook handler not implemented" };
      },
    );
  },
  { name: "stripe-webhooks-plugin" },
);
