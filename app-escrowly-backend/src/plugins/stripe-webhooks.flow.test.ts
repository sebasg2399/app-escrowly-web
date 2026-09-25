import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://escrowly:escrowly@localhost:5433/escrowly_test";
process.env.JWT_SECRET = "test-jwt-secret-for-testing-only";
process.env.ACCESS_TOKEN_TTL = "5m";
process.env.REFRESH_TOKEN_TTL_DAYS = "7";
process.env.COOKIE_NAME = "escrowly_refresh";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";

import type { FastifyInstance } from "fastify";
import { prisma } from "../lib/prisma.js";
import { truncateTables } from "../test/helpers.js";
import { FakeStripeClient } from "../adapters/stripe/stripe-client.fake.js";

let app: FastifyInstance;
let fake: FakeStripeClient;

beforeAll(async () => {
  const { buildApp } = await import("../app.js");
  app = await buildApp();
  await app.ready();
  fake = (app as FastifyInstance & { stripeClient: FakeStripeClient }).stripeClient;
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await truncateTables();
  fake.reset();
  fake.webhook.setSecret("whsec_test_secret");
});

async function registerUser(email: string, name: string): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { name, email, password: "SecurePass1" },
  });
  if (res.statusCode !== 201) {
    throw new Error(`registerUser(${email}) failed: ${res.statusCode} ${res.payload}`);
  }
  const body = JSON.parse(res.payload);
  return body.accessToken as string;
}

async function createPendingContract(
  clientEmail: string,
  sellerEmail: string,
  amount = 5000,
): Promise<{ contractId: string; milestoneId: string; clientToken: string }> {
  const clientToken = await registerUser(clientEmail, "Client");
  await registerUser(sellerEmail, "Seller");
  const created = await app.inject({
    method: "POST",
    url: "/contracts",
    headers: { Authorization: `Bearer ${clientToken}` },
    payload: {
      sellerEmail,
      milestones: [{ title: "M", amount }],
    },
  });
  const body = JSON.parse(created.payload);
  return {
    contractId: body.id,
    milestoneId: body.milestones[0].id,
    clientToken,
  };
}

function emit(event: { id: string; type: string; data?: unknown }) {
  const e = fake.webhook.emit(event) as unknown as {
    id: string;
    type: string;
    data: { object: unknown };
    __signature: string;
    __rawBody: Buffer;
  };
  return e;
}

async function postWebhook(emitted: ReturnType<typeof emit>) {
  return app.inject({
    method: "POST",
    url: "/webhooks/stripe",
    headers: {
      "content-type": "application/json",
      "stripe-signature": emitted.__signature,
    },
    payload: emitted.__rawBody.toString("utf8"),
  });
}

describe("Stripe webhook — payment_intent.succeeded", () => {
  it("transitions pending → funded, writes platform_receipt ledger, and sets contract active on first funded", async () => {
    const { contractId, milestoneId, clientToken } = await createPendingContract(
      "client-webhook@example.com",
      "seller-webhook@example.com",
      7500,
    );

    const fundRes = await app.inject({
      method: "POST",
      url: `/contracts/${contractId}/milestones/${milestoneId}/fund`,
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    expect(fundRes.statusCode).toBe(200);
    const piId = JSON.parse(fundRes.payload).id;

    const emitted = emit({
      id: "evt_pi_succeeded_1",
      type: "payment_intent.succeeded",
      data: {
        id: piId,
        metadata: { milestoneId, contractId },
      },
    });

    const res = await postWebhook(emitted);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ processed: true });

    const milestone = await prisma.milestone.findUnique({ where: { id: milestoneId } });
    expect(milestone!.status).toBe("funded");

    const ledger = await prisma.ledgerEntry.findMany({ where: { milestoneId } });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({
      kind: "platform_receipt",
      side: "credit",
      amount: 7500,
      currency: "usd",
      reference: piId,
      idempotencyKey: "pi:evt_pi_succeeded_1",
    });

    const contract = await prisma.contract.findUnique({ where: { id: contractId } });
    expect(contract!.status).toBe("active");

    const webhookRows = await prisma.stripeWebhookEvent.findMany();
    expect(webhookRows).toHaveLength(1);
  });

  it("is idempotent on re-delivery: 1 ledger row, 1 webhook row, status stable, both responses 2xx", async () => {
    const { contractId, milestoneId, clientToken } = await createPendingContract(
      "client-idem@example.com",
      "seller-idem@example.com",
      3000,
    );

    const fundRes = await app.inject({
      method: "POST",
      url: `/contracts/${contractId}/milestones/${milestoneId}/fund`,
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    const piId = JSON.parse(fundRes.payload).id;

    const payload = {
      id: "evt_pi_succeeded_2",
      type: "payment_intent.succeeded",
      data: { id: piId, metadata: { milestoneId, contractId } },
    };

    const first = await postWebhook(emit(payload));
    expect(first.statusCode).toBe(200);

    // Re-sign the same rawBody so the second delivery has a fresh timestamp.
    const fresh = emit(payload);
    const second = await postWebhook(fresh);
    expect(second.statusCode).toBe(200);

    const milestone = await prisma.milestone.findUnique({ where: { id: milestoneId } });
    expect(milestone!.status).toBe("funded");

    const ledger = await prisma.ledgerEntry.findMany({ where: { milestoneId } });
    expect(ledger).toHaveLength(1);

    const webhookRows = await prisma.stripeWebhookEvent.findMany({
      where: { eventId: "evt_pi_succeeded_2" },
    });
    expect(webhookRows).toHaveLength(1);
  });

  it("does not transition contract from completed back to active (idempotent under re-delivery)", async () => {
    const { contractId, milestoneId, clientToken } = await createPendingContract(
      "client-state@example.com",
      "seller-state@example.com",
      4000,
    );

    const fundRes = await app.inject({
      method: "POST",
      url: `/contracts/${contractId}/milestones/${milestoneId}/fund`,
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    const piId = JSON.parse(fundRes.payload).id;

    // Move contract to completed before the webhook lands.
    await prisma.contract.update({
      where: { id: contractId },
      data: { status: "completed" },
    });

    const res = await postWebhook(
      emit({
        id: "evt_pi_after_completed",
        type: "payment_intent.succeeded",
        data: { id: piId, metadata: { milestoneId, contractId } },
      }),
    );
    expect(res.statusCode).toBe(200);

    const contract = await prisma.contract.findUnique({ where: { id: contractId } });
    expect(contract!.status).toBe("completed");
  });
});

describe("Stripe webhook — payment_intent.payment_failed", () => {
  it("leaves the milestone pending and writes no ledger row", async () => {
    const { contractId, milestoneId, clientToken } = await createPendingContract(
      "client-failed@example.com",
      "seller-failed@example.com",
      2500,
    );

    const fundRes = await app.inject({
      method: "POST",
      url: `/contracts/${contractId}/milestones/${milestoneId}/fund`,
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    const piId = JSON.parse(fundRes.payload).id;

    const res = await postWebhook(
      emit({
        id: "evt_pi_failed_1",
        type: "payment_intent.payment_failed",
        data: { id: piId, metadata: { milestoneId, contractId } },
      }),
    );
    expect(res.statusCode).toBe(200);

    const milestone = await prisma.milestone.findUnique({ where: { id: milestoneId } });
    expect(milestone!.status).toBe("pending");

    const ledger = await prisma.ledgerEntry.count();
    expect(ledger).toBe(0);

    const contract = await prisma.contract.findUnique({ where: { id: contractId } });
    expect(contract!.status).toBe("draft");
  });
});

describe("Stripe webhook — account.updated", () => {
  it("updates the user's payout flags", async () => {
    const sellerEmail = "seller-onboarding@example.com";
    await registerUser(sellerEmail, "Seller Onboarding");
    const sellerUser = await prisma.user.findUnique({ where: { email: sellerEmail } });
    expect(sellerUser).not.toBeNull();
    const accountId = `acct_test_${sellerUser!.id}`;
    await prisma.user.update({
      where: { id: sellerUser!.id },
      data: { stripeAccountId: accountId },
    });

    const res = await postWebhook(
      emit({
        id: "evt_account_updated_1",
        type: "account.updated",
        data: { id: accountId, payouts_enabled: true, details_submitted: true },
      }),
    );
    expect(res.statusCode).toBe(200);

    const updated = await prisma.user.findUnique({ where: { id: sellerUser!.id } });
    expect(updated!.stripeAccountPayoutsEnabled).toBe(true);
    expect(updated!.stripeAccountDetailsSubmitted).toBe(true);
  });

  it("is a no-op on re-delivery", async () => {
    const sellerEmail = "seller-onboarding-dup@example.com";
    await registerUser(sellerEmail, "Seller Onboarding Dup");
    const sellerUser = await prisma.user.findUnique({ where: { email: sellerEmail } });
    expect(sellerUser).not.toBeNull();
    const accountId = `acct_dup_${sellerUser!.id}`;
    await prisma.user.update({
      where: { id: sellerUser!.id },
      data: { stripeAccountId: accountId },
    });

    const payload = {
      id: "evt_account_updated_dup",
      type: "account.updated",
      data: { id: accountId, payouts_enabled: true, details_submitted: true },
    };

    const first = await postWebhook(emit(payload));
    expect(first.statusCode).toBe(200);

    const after1 = await prisma.user.findUnique({ where: { id: sellerUser!.id } });
    expect(after1!.stripeAccountPayoutsEnabled).toBe(true);

    const second = await postWebhook(emit(payload));
    expect(second.statusCode).toBe(200);

    const webhookRows = await prisma.stripeWebhookEvent.findMany({
      where: { eventId: "evt_account_updated_dup" },
    });
    expect(webhookRows).toHaveLength(1);
  });
});

describe("Stripe webhook — transfer.* events", () => {
  it("acknowledges transfer.created with 200 and writes no ledger", async () => {
    const res = await postWebhook(
      emit({
        id: "evt_transfer_created_1",
        type: "transfer.created",
        data: { id: "tr_fake_test", amount: 1000 },
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(await prisma.ledgerEntry.count()).toBe(0);
  });

  it("acknowledges transfer.failed with 200 and writes no ledger", async () => {
    const res = await postWebhook(
      emit({
        id: "evt_transfer_failed_1",
        type: "transfer.failed",
        data: { id: "tr_fake_failed", amount: 1000 },
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(await prisma.ledgerEntry.count()).toBe(0);
  });

  it("records transfer.created in stripe_webhook_events so re-delivery is a no-op", async () => {
    const eventId = "evt_transfer_created_dedup";
    const payload = {
      id: eventId,
      type: "transfer.created",
      data: { id: "tr_fake_dedup", amount: 500 },
    };

    const first = await postWebhook(emit(payload));
    expect(first.statusCode).toBe(200);

    const second = await postWebhook(emit(payload));
    expect(second.statusCode).toBe(200);

    const rows = await prisma.stripeWebhookEvent.findMany({ where: { eventId } });
    expect(rows).toHaveLength(1);

    const ledger = await prisma.ledgerEntry.count();
    expect(ledger).toBe(0);
  });

  it("records transfer.failed in stripe_webhook_events so re-delivery is a no-op", async () => {
    const eventId = "evt_transfer_failed_dedup";
    const payload = {
      id: eventId,
      type: "transfer.failed",
      data: { id: "tr_fake_failed_dedup", amount: 500 },
    };

    const first = await postWebhook(emit(payload));
    expect(first.statusCode).toBe(200);

    const second = await postWebhook(emit(payload));
    expect(second.statusCode).toBe(200);

    const rows = await prisma.stripeWebhookEvent.findMany({ where: { eventId } });
    expect(rows).toHaveLength(1);
  });
});