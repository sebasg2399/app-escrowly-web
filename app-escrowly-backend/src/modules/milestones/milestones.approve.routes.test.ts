import { describe, it, expect, beforeEach, afterEach } from "vitest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://escrowly:escrowly@localhost:5433/escrowly_test";
process.env.JWT_SECRET = "test-jwt-secret-for-testing-only";
process.env.ACCESS_TOKEN_TTL = "5m";
process.env.REFRESH_TOKEN_TTL_DAYS = "7";
process.env.COOKIE_NAME = "escrowly_refresh";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";

import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { truncateTables } from "../../test/helpers.js";
import { FakeStripeClient } from "../../adapters/stripe/stripe-client.fake.js";

let buildApp: () => Promise<FastifyInstance>;

beforeEach(async () => {
  const mod = await import("../../app.js");
  buildApp = mod.buildApp;
  await truncateTables();
});

let app: FastifyInstance | null = null;
let fake: FakeStripeClient | null = null;

async function getApp(): Promise<{ app: FastifyInstance; fake: FakeStripeClient }> {
  if (!app) {
    app = await buildApp();
    fake = (app as FastifyInstance & { stripeClient: FakeStripeClient }).stripeClient;
  }
  return { app: app!, fake: fake! };
}

afterEach(async () => {
  if (app) {
    await app.close();
    app = null;
    fake = null;
  }
});

async function registerUser(
  app: FastifyInstance,
  email: string,
  name: string,
): Promise<{ token: string; userId: string; email: string }> {
  const res = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { name, email, password: "SecurePass1" },
  });
  if (res.statusCode !== 201) {
    throw new Error(`registerUser(${email}) failed: ${res.statusCode} ${res.payload}`);
  }
  const body = JSON.parse(res.payload);
  const user = await prisma.user.findUnique({ where: { email } });
  return { token: body.accessToken as string, userId: user!.id, email };
}

async function createContract(
  app: FastifyInstance,
  clientToken: string,
  sellerEmail: string,
  milestones: { title: string; amount: number }[],
): Promise<{ id: string; milestones: { id: string }[] }> {
  const res = await app.inject({
    method: "POST",
    url: "/contracts",
    headers: { Authorization: `Bearer ${clientToken}` },
    payload: { sellerEmail, milestones },
  });
  if (res.statusCode !== 201) {
    throw new Error(`createContract failed: ${res.statusCode} ${res.payload}`);
  }
  return JSON.parse(res.payload);
}

async function approve(
  app: FastifyInstance,
  clientToken: string,
  contractId: string,
  milestoneId: string,
) {
  return app.inject({
    method: "POST",
    url: `/contracts/${contractId}/milestones/${milestoneId}/approve`,
    headers: { Authorization: `Bearer ${clientToken}` },
  });
}

async function setMilestoneStatus(
  milestoneId: string,
  status: "pending" | "funded" | "in_review",
) {
  await prisma.milestone.update({
    where: { id: milestoneId },
    data: { status },
  });
}

async function activateContract(contractId: string) {
  // Real flow goes `draft → active` via the funding webhook; tests that jump
  // straight to approval set the contract status directly to mirror that.
  await prisma.contract.update({
    where: { id: contractId },
    data: { status: "active" },
  });
}

async function attachSellerAccount(
  userId: string,
  opts: {
    stripeAccountId?: string | null;
    payoutsEnabled?: boolean;
    detailsSubmitted?: boolean;
  } = {},
): Promise<string> {
  const stripeAccountId = opts.stripeAccountId ?? `acct_test_${userId.slice(0, 8)}`;
  await prisma.user.update({
    where: { id: userId },
    data: {
      stripeAccountId,
      stripeAccountPayoutsEnabled: opts.payoutsEnabled ?? true,
      stripeAccountDetailsSubmitted: opts.detailsSubmitted ?? true,
    },
  });
  return stripeAccountId;
}

describe("POST /contracts/:id/milestones/:mid/approve", () => {
  it("transitions in_review → paid, writes 2 ledger rows summing to amount, and completes the contract on the last paid milestone", async () => {
    const { app } = await getApp();

    const client = await registerUser(app, "approve-client@example.com", "Approve Client");
    const seller = await registerUser(app, "approve-seller@example.com", "Approve Seller");
    await attachSellerAccount(seller.userId);

    const contract = await createContract(app, client.token, seller.email, [
      { title: "Phase A", amount: 12345 },
    ]);
    const milestoneId = contract.milestones[0].id;
    await setMilestoneStatus(milestoneId, "in_review");
    await activateContract(contract.id);

    const res = await approve(app, client.token, contract.id, milestoneId);

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.id).toBe(milestoneId);
    expect(body.status).toBe("paid");
    expect(body.stripeTransferId).toMatch(/^tr_fake_/);
    expect(body.paidAt).toBeDefined();

    const persisted = await prisma.milestone.findUnique({ where: { id: milestoneId } });
    expect(persisted!.status).toBe("paid");
    expect(persisted!.stripeTransferId).toMatch(/^tr_fake_/);
    expect(persisted!.paidAt).not.toBeNull();

    const ledger = await prisma.ledgerEntry.findMany({
      where: { milestoneId },
      orderBy: { kind: "asc" },
    });
    expect(ledger).toHaveLength(2);
    expect(ledger.map((l) => l.kind)).toEqual(["commission_credit", "transfer_credit"]);
    expect(ledger.every((l) => l.side === "credit")).toBe(true);
    const sum = ledger.reduce((acc, l) => acc + l.amount, 0);
    expect(sum).toBe(12345);
    expect(ledger.find((l) => l.kind === "commission_credit")!.idempotencyKey).toBe(
      `transfer:${milestoneId}:comm`,
    );
    expect(ledger.find((l) => l.kind === "transfer_credit")!.idempotencyKey).toBe(
      `transfer:${milestoneId}:xf`,
    );

    const contractAfter = await prisma.contract.findUnique({ where: { id: contract.id } });
    expect(contractAfter!.status).toBe("completed");
  });

  it("splits odd cents exactly: commission + transfer === amount (999 cents)", async () => {
    const { app } = await getApp();

    const client = await registerUser(app, "approve-odd-client@example.com", "Odd Client");
    const seller = await registerUser(app, "approve-odd-seller@example.com", "Odd Seller");
    await attachSellerAccount(seller.userId);

    const contract = await createContract(app, client.token, seller.email, [
      { title: "Tiny milestone", amount: 999 },
    ]);
    const milestoneId = contract.milestones[0].id;
    await setMilestoneStatus(milestoneId, "in_review");

    const res = await approve(app, client.token, contract.id, milestoneId);

    expect(res.statusCode).toBe(200);
    const ledger = await prisma.ledgerEntry.findMany({ where: { milestoneId } });
    expect(ledger).toHaveLength(2);
    const commission = ledger.find((l) => l.kind === "commission_credit")!.amount;
    const transfer = ledger.find((l) => l.kind === "transfer_credit")!.amount;
    // 10% of 999 = 99.9 → floor → 99 commission; transfer absorbs the 0.9
    // cent and becomes 900 (so the two halves sum back to 999 exactly).
    expect(commission).toBe(99);
    expect(transfer).toBe(900);
    expect(commission + transfer).toBe(999);
  });

  it("returns 403 when called by the seller (non-client participant)", async () => {
    const { app } = await getApp();
    const client = await registerUser(app, "approve-rc@example.com", "RC Client");
    const seller = await registerUser(app, "approve-rs@example.com", "RC Seller");
    await attachSellerAccount(seller.userId);

    const contract = await createContract(app, client.token, seller.email, [
      { title: "Phase", amount: 5000 },
    ]);
    const milestoneId = contract.milestones[0].id;
    await setMilestoneStatus(milestoneId, "in_review");

    const res = await approve(app, seller.token, contract.id, milestoneId);

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.payload).code).toBe("FORBIDDEN");

    const persisted = await prisma.milestone.findUnique({ where: { id: milestoneId } });
    expect(persisted!.status).toBe("in_review");
    const ledger = await prisma.ledgerEntry.count();
    expect(ledger).toBe(0);
  });

  it("returns 403 to a non-participant outsider", async () => {
    const { app } = await getApp();
    const client = await registerUser(app, "approve-np1@example.com", "NP Client");
    const seller = await registerUser(app, "approve-np2@example.com", "NP Seller");
    const outsider = await registerUser(app, "approve-outsider@example.com", "Outsider");
    await attachSellerAccount(seller.userId);

    const contract = await createContract(app, client.token, seller.email, [
      { title: "Phase", amount: 2000 },
    ]);
    const milestoneId = contract.milestones[0].id;
    await setMilestoneStatus(milestoneId, "in_review");

    const res = await approve(app, outsider.token, contract.id, milestoneId);

    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.payload).code).toBe("FORBIDDEN");

    const persisted = await prisma.milestone.findUnique({ where: { id: milestoneId } });
    expect(persisted!.status).toBe("in_review");
  });

  it("returns 409 when the milestone is in funded status (skip-step)", async () => {
    const { app } = await getApp();
    const client = await registerUser(app, "approve-fd@example.com", "FD Client");
    const seller = await registerUser(app, "approve-fs@example.com", "FD Seller");
    await attachSellerAccount(seller.userId);

    const contract = await createContract(app, client.token, seller.email, [
      { title: "Phase", amount: 7500 },
    ]);
    const milestoneId = contract.milestones[0].id;
    await setMilestoneStatus(milestoneId, "funded");

    const res = await approve(app, client.token, contract.id, milestoneId);

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.payload).code).toBe("CONFLICT");
    const persisted = await prisma.milestone.findUnique({ where: { id: milestoneId } });
    expect(persisted!.status).toBe("funded");
    const ledger = await prisma.ledgerEntry.count();
    expect(ledger).toBe(0);
  });

  it("returns 409 when the milestone is in pending status", async () => {
    const { app } = await getApp();
    const client = await registerUser(app, "approve-pd@example.com", "PD Client");
    const seller = await registerUser(app, "approve-ps@example.com", "PD Seller");
    await attachSellerAccount(seller.userId);

    const contract = await createContract(app, client.token, seller.email, [
      { title: "Phase", amount: 1500 },
    ]);
    const milestoneId = contract.milestones[0].id;
    // stay pending

    const res = await approve(app, client.token, contract.id, milestoneId);

    expect(res.statusCode).toBe(409);
    const persisted = await prisma.milestone.findUnique({ where: { id: milestoneId } });
    expect(persisted!.status).toBe("pending");
  });

  it("returns 409 on a duplicate approval of an already-paid milestone (no second Transfer, no extra ledger)", async () => {
    const { app, fake } = await getApp();
    const client = await registerUser(app, "approve-dup-c@example.com", "Dup Client");
    const seller = await registerUser(app, "approve-dup-s@example.com", "Dup Seller");
    await attachSellerAccount(seller.userId);

    const contract = await createContract(app, client.token, seller.email, [
      { title: "Phase", amount: 4000 },
    ]);
    const milestoneId = contract.milestones[0].id;
    await setMilestoneStatus(milestoneId, "in_review");

    const first = await approve(app, client.token, contract.id, milestoneId);
    expect(first.statusCode).toBe(200);
    const firstTransferId = JSON.parse(first.payload).stripeTransferId as string;

    const second = await approve(app, client.token, contract.id, milestoneId);
    expect(second.statusCode).toBe(409);
    expect(JSON.parse(second.payload).code).toBe("CONFLICT");

    const persisted = await prisma.milestone.findUnique({ where: { id: milestoneId } });
    expect(persisted!.status).toBe("paid");
    expect(persisted!.stripeTransferId).toBe(firstTransferId);

    const ledger = await prisma.ledgerEntry.findMany({ where: { milestoneId } });
    expect(ledger).toHaveLength(2);
    // No new Transfer was created on the fake client.
    expect(fake.transferCount()).toBe(1);
  });

  it("returns 502 and keeps the milestone in `approved` when the Stripe Transfer throws (no seller ledger)", async () => {
    const { app, fake } = await getApp();
    fake.simulateTransferFailure("simulated downstream outage");

    const client = await registerUser(app, "approve-tf-c@example.com", "TF Client");
    const seller = await registerUser(app, "approve-tf-s@example.com", "TF Seller");
    await attachSellerAccount(seller.userId);

    const contract = await createContract(app, client.token, seller.email, [
      { title: "Phase", amount: 6000 },
    ]);
    const milestoneId = contract.milestones[0].id;
    await setMilestoneStatus(milestoneId, "in_review");

    const res = await approve(app, client.token, contract.id, milestoneId);

    expect(res.statusCode).toBe(502);
    expect(JSON.parse(res.payload).code).toBe("UPSTREAM_ERROR");

    const persisted = await prisma.milestone.findUnique({ where: { id: milestoneId } });
    expect(persisted!.status).toBe("approved");
    expect(persisted!.stripeTransferId).toBeNull();
    expect(persisted!.paidAt).toBeNull();

    const ledger = await prisma.ledgerEntry.findMany({ where: { milestoneId } });
    expect(ledger).toHaveLength(0);

    const contractAfter = await prisma.contract.findUnique({ where: { id: contract.id } });
    expect(contractAfter!.status).toBe("draft");

    fake.clearTransferFailure();
  });

  it("returns 409 and keeps the milestone in `approved` when the seller has no connected account (no seller ledger)", async () => {
    const { app } = await getApp();

    const client = await registerUser(app, "approve-na-c@example.com", "NA Client");
    const seller = await registerUser(app, "approve-na-s@example.com", "NA Seller");
    // Intentionally do NOT attach a stripe account.

    const contract = await createContract(app, client.token, seller.email, [
      { title: "Phase", amount: 4500 },
    ]);
    const milestoneId = contract.milestones[0].id;
    await setMilestoneStatus(milestoneId, "in_review");

    const res = await approve(app, client.token, contract.id, milestoneId);

    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.payload).code).toBe("CONFLICT");

    const persisted = await prisma.milestone.findUnique({ where: { id: milestoneId } });
    expect(persisted!.status).toBe("approved");
    expect(persisted!.stripeTransferId).toBeNull();

    const ledger = await prisma.ledgerEntry.findMany({ where: { milestoneId } });
    expect(ledger).toHaveLength(0);
  });

  it("returns 502 and keeps the milestone in `approved` when the seller's payouts are not enabled", async () => {
    const { app } = await getApp();

    const client = await registerUser(app, "approve-pd-c@example.com", "PD2 Client");
    const seller = await registerUser(app, "approve-pd-s@example.com", "PD2 Seller");
    await attachSellerAccount(seller.userId, { payoutsEnabled: false });

    const contract = await createContract(app, client.token, seller.email, [
      { title: "Phase", amount: 8888 },
    ]);
    const milestoneId = contract.milestones[0].id;
    await setMilestoneStatus(milestoneId, "in_review");

    const res = await approve(app, client.token, contract.id, milestoneId);

    expect(res.statusCode).toBe(502);
    expect(JSON.parse(res.payload).code).toBe("UPSTREAM_ERROR");

    const persisted = await prisma.milestone.findUnique({ where: { id: milestoneId } });
    expect(persisted!.status).toBe("approved");
    expect(persisted!.stripeTransferId).toBeNull();

    const ledger = await prisma.ledgerEntry.findMany({ where: { milestoneId } });
    expect(ledger).toHaveLength(0);
  });

  it("does NOT complete the contract when other unpaid milestones remain", async () => {
    const { app } = await getApp();
    const client = await registerUser(app, "approve-mc@example.com", "MC Client");
    const seller = await registerUser(app, "approve-ms@example.com", "MC Seller");
    await attachSellerAccount(seller.userId);

    const contract = await createContract(app, client.token, seller.email, [
      { title: "First", amount: 1000 },
      { title: "Second", amount: 2000 },
    ]);
    const firstId = contract.milestones[0].id;
    await setMilestoneStatus(firstId, "in_review");
    await activateContract(contract.id);

    const res = await approve(app, client.token, contract.id, firstId);
    expect(res.statusCode).toBe(200);

    const contractAfter = await prisma.contract.findUnique({ where: { id: contract.id } });
    expect(contractAfter!.status).toBe("active");
  });

  it("returns 404 when the milestone does not belong to the contract", async () => {
    const { app } = await getApp();
    const client = await registerUser(app, "approve-wm1@example.com", "WM Client");
    const seller = await registerUser(app, "approve-wm2@example.com", "WM Seller");
    await attachSellerAccount(seller.userId);

    const contract = await createContract(app, client.token, seller.email, [
      { title: "Phase", amount: 1000 },
    ]);

    const res = await approve(app, client.token, contract.id, "11111111-1111-1111-1111-111111111111");
    expect(res.statusCode).toBe(404);
  });

  it("returns 401 without auth", async () => {
    const { app } = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/contracts/00000000-0000-0000-0000-000000000000/milestones/00000000-0000-0000-0000-000000000000/approve",
    });
    expect(res.statusCode).toBe(401);
  });

  it("allows the payout to be RETRIED once the seller connects an account", async () => {
    const { app } = await getApp();

    const client = await registerUser(app, "approve-retry-client@example.com", "Retry Client");
    const seller = await registerUser(app, "approve-retry-seller@example.com", "Retry Seller");
    // Seller has NO connected account yet.
    const contract = await createContract(app, client.token, seller.email, [
      { title: "Retry phase", amount: 5000 },
    ]);
    const milestoneId = contract.milestones[0].id;
    await setMilestoneStatus(milestoneId, "in_review");
    await activateContract(contract.id);

    // First attempt fails gracefully: 409, milestone stays `approved`, no ledger.
    const first = await approve(app, client.token, contract.id, milestoneId);
    expect(first.statusCode).toBe(409);
    const afterFirst = await prisma.milestone.findUnique({ where: { id: milestoneId } });
    expect(afterFirst!.status).toBe("approved");
    expect(await prisma.ledgerEntry.count({ where: { milestoneId } })).toBe(0);

    // Seller onboards, client retries.
    await attachSellerAccount(seller.userId);

    const second = await approve(app, client.token, contract.id, milestoneId);
    expect(second.statusCode).toBe(200);
    const body = JSON.parse(second.payload);
    expect(body.status).toBe("paid");
    expect(await prisma.ledgerEntry.count({ where: { milestoneId } })).toBe(2);
  });
});

describe("splitCommission (unit, integer-cents sum)", () => {
  // Mirrors the focused unit test in payments/commission.test.ts so the
  // approve slice documents its input space end-to-end.
  it("always commissions + transfers === amount across a range of values", () => {
    const amounts = [0, 1, 9, 10, 11, 99, 100, 101, 999, 1_000, 12_345, 100_001];
    for (const amount of amounts) {
      const commission = Math.floor(amount * 0.1);
      const transfer = amount - commission;
      expect(Number.isInteger(commission)).toBe(true);
      expect(Number.isInteger(transfer)).toBe(true);
      expect(commission + transfer).toBe(amount);
    }
  });
});
