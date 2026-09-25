import type { FastifyInstance, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { env } from "../config/env.js";
import type { PrismaClient } from "@prisma/client";
import type { ContractRepository } from "../ports/contract-repository.js";
import type { MilestoneRepository } from "../ports/milestone-repository.js";
import type { LedgerRepository } from "../ports/ledger-repository.js";
import type { WebhookEventRepository } from "../ports/webhook-event-repository.js";
import type { UserRepository } from "../ports/user-repository.js";
import type { StripeClient, WebhookEventLike } from "../ports/stripe-client.js";

declare module "fastify" {
  interface FastifyRequest {
    rawBody?: Buffer;
  }
}

export interface StripeWebhooksPluginOptions {
  stripeClient: StripeClient;
  prisma: PrismaClient;
  contractRepository: ContractRepository;
  milestoneRepository: MilestoneRepository;
  ledgerRepository: LedgerRepository;
  webhookEventRepository: WebhookEventRepository;
  userRepository: UserRepository;
}

interface PaymentIntentObject {
  id: string;
  metadata?: { milestoneId?: string; contractId?: string };
}

interface AccountObject {
  id: string;
  payouts_enabled?: boolean;
  details_submitted?: boolean;
}

/**
 * Stripe webhook receiver. Registers an encapsulated content-type parser
 * for `application/json` so the raw buffer is available for signature
 * verification; JSON.parse happens for normal consumer readability.
 *
 * The handler verifies the signature, dedups by Stripe event id, and
 * dispatches the supported event types. Duplicate or unknown events
 * MUST NOT produce a 5xx (Stripe would retry and amplify load).
 */
export const stripeWebhooksPlugin = fp(
  async (app: FastifyInstance, opts: StripeWebhooksPluginOptions) => {
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
      { config: { rawBody: true } },
      async (request, reply) => {
        const rawBody = (request as FastifyRequest).rawBody;
        const signature = request.headers["stripe-signature"];
        const secret = env.STRIPE_WEBHOOK_SECRET;

        if (!rawBody || !signature || !secret) {
          const err = new Error("Missing signature or webhook secret") as Error & {
            statusCode: number;
            code: string;
          };
          err.statusCode = 400;
          err.code = "VALIDATION_ERROR";
          throw err;
        }

        let event: WebhookEventLike;
        try {
          event = opts.stripeClient.constructWebhookEvent({
            rawBody,
            signature: Array.isArray(signature) ? signature[0] : signature,
            secret,
          });
        } catch (err) {
          app.log.warn({ err }, "Stripe webhook signature verification failed");
          const bad = new Error("Invalid signature") as Error & {
            statusCode: number;
            code: string;
          };
          bad.statusCode = 400;
          bad.code = "VALIDATION_ERROR";
          throw bad;
        }

        try {
          await dispatch(app, opts, event);
        } catch (err) {
          app.log.error({ err, eventId: event.id, type: event.type }, "Stripe webhook handler failed");
          const internal = new Error("Webhook processing failed") as Error & {
            statusCode: number;
            code: string;
          };
          internal.statusCode = 500;
          internal.code = "INTERNAL";
          throw internal;
        }

        return { processed: true };
      },
    );
  },
  { name: "stripe-webhooks-plugin" },
);

async function dispatch(
  app: FastifyInstance,
  opts: StripeWebhooksPluginOptions,
  event: WebhookEventLike,
): Promise<void> {
  switch (event.type) {
    case "payment_intent.succeeded":
      await handlePaymentIntentSucceeded(app, opts, event);
      return;
    case "payment_intent.payment_failed":
      await handlePaymentIntentFailed(app, opts, event);
      return;
    case "account.updated":
      await handleAccountUpdated(app, opts, event);
      return;
    case "transfer.created":
    case "transfer.failed":
      app.log.info(
        { eventId: event.id, type: event.type },
        "Stripe transfer webhook acknowledged (payout slice finalizes transfer accounting)",
      );
      return;
    default:
      app.log.info({ eventId: event.id, type: event.type }, "Unknown Stripe event type — ignored");
      return;
  }
}

async function handlePaymentIntentSucceeded(
  app: FastifyInstance,
  opts: StripeWebhooksPluginOptions,
  event: WebhookEventLike,
): Promise<void> {
  const pi = event.data.object as PaymentIntentObject;
  if (!pi || !pi.id) {
    throw new Error("payment_intent.succeeded missing PaymentIntent id");
  }

  const inserted = await opts.prisma.$transaction(async (tx) => {
    const isNew = await opts.webhookEventRepository.tryInsert(
      { eventId: event.id, type: event.type },
      tx,
    );
    if (!isNew) return false;

    let milestone = await opts.milestoneRepository.findByStripePaymentIntentId(pi.id, tx);
    if (!milestone && pi.metadata?.milestoneId) {
      milestone = await opts.milestoneRepository.findById(pi.metadata.milestoneId, tx);
      if (milestone && !milestone.stripePaymentIntentId) {
        await tx.milestone.update({
          where: { id: milestone.id },
          data: { stripePaymentIntentId: pi.id },
        });
      }
    }
    if (!milestone) {
      throw new Error(`Milestone not found for PaymentIntent ${pi.id}`);
    }

    const updated = await opts.milestoneRepository.transitionStatusIf(
      milestone.id,
      "pending",
      "funded",
      undefined,
      tx,
    );
    if (!updated) {
      // Already in a later status (e.g. duplicate delivery raced ahead) — no-op.
      return true;
    }

    await opts.ledgerRepository.create(
      {
        milestoneId: milestone.id,
        contractId: milestone.contractId,
        kind: "platform_receipt",
        side: "credit",
        amount: updated.amount,
        currency: updated.currency,
        reference: pi.id,
        idempotencyKey: `pi:${event.id}`,
      },
      tx,
    );

    const fundedCount = await tx.milestone.count({
      where: { contractId: milestone.contractId, status: "funded" },
    });
    if (fundedCount === 1) {
      await opts.contractRepository.transitionStatusIf(
        milestone.contractId,
        "draft",
        "active",
        tx,
      );
    }

    return true;
  });

  if (!inserted) {
    app.log.info(
      { eventId: event.id, type: event.type },
      "Duplicate Stripe webhook event — skipped",
    );
  }
}

async function handlePaymentIntentFailed(
  app: FastifyInstance,
  opts: StripeWebhooksPluginOptions,
  event: WebhookEventLike,
): Promise<void> {
  const pi = event.data.object as PaymentIntentObject;
  const inserted = await opts.prisma.$transaction((tx) =>
    opts.webhookEventRepository.tryInsert({ eventId: event.id, type: event.type }, tx),
  );
  if (!inserted) {
    app.log.info(
      { eventId: event.id, type: event.type },
      "Duplicate payment_intent.payment_failed — skipped",
    );
    return;
  }
  app.log.info(
    { eventId: event.id, paymentIntentId: pi?.id },
    "payment_intent.payment_failed — milestone stays pending, no ledger",
  );
}

async function handleAccountUpdated(
  app: FastifyInstance,
  opts: StripeWebhooksPluginOptions,
  event: WebhookEventLike,
): Promise<void> {
  const account = event.data.object as AccountObject;
  if (!account || !account.id) {
    throw new Error("account.updated missing Account id");
  }

  await opts.prisma.$transaction(async (tx) => {
    const isNew = await opts.webhookEventRepository.tryInsert(
      { eventId: event.id, type: event.type },
      tx,
    );
    if (!isNew) {
      app.log.info(
        { eventId: event.id, type: event.type },
        "Duplicate account.updated — skipped",
      );
      return;
    }

    const user = await opts.userRepository.findByStripeAccountId(account.id);
    if (!user) {
      app.log.warn(
        { eventId: event.id, stripeAccountId: account.id },
        "account.updated for unknown account — no-op",
      );
      return;
    }

    await tx.user.update({
      where: { id: user.id },
      data: {
        stripeAccountPayoutsEnabled: Boolean(account.payouts_enabled),
        stripeAccountDetailsSubmitted: Boolean(account.details_submitted),
      },
    });
  });
}