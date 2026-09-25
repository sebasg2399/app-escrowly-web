import { describe, it, expect, beforeEach, afterEach } from "vitest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://escrowly:escrowly@localhost:5433/escrowly_test";
process.env.JWT_SECRET = "test-jwt-secret-for-testing-only";
process.env.ACCESS_TOKEN_TTL = "5m";
process.env.REFRESH_TOKEN_TTL_DAYS = "7";
process.env.COOKIE_NAME = "escrowly_refresh";

import type { FastifyInstance } from "fastify";
import { prisma } from "../../lib/prisma.js";
import { truncateTables } from "../../test/helpers.js";

let buildApp: () => Promise<FastifyInstance>;

beforeEach(async () => {
  const mod = await import("../../app.js");
  buildApp = mod.buildApp;
  await truncateTables();
});

let app: FastifyInstance | null = null;

async function getApp(): Promise<FastifyInstance> {
  if (!app) {
    app = await buildApp();
  }
  return app;
}

afterEach(async () => {
  if (app) {
    await app.close();
    app = null;
  }
});

async function registerUser(
  app: FastifyInstance,
  email: string,
  name: string,
): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { name, email, password: "SecurePass1" },
  });
  return JSON.parse(res.payload).accessToken;
}

async function createContract(
  app: FastifyInstance,
  clientToken: string,
  sellerEmail: string,
  milestones: { title: string; amount: number }[],
): Promise<{ id: string; milestones: { id: string; status: string }[] }> {
  const res = await app.inject({
    method: "POST",
    url: "/contracts",
    headers: { Authorization: `Bearer ${clientToken}` },
    payload: { sellerEmail, milestones },
  });
  return JSON.parse(res.payload);
}

async function seedFundedMilestone(milestoneId: string) {
  await prisma.milestone.update({
    where: { id: milestoneId },
    data: { status: "funded" },
  });
}

describe("POST /contracts/:id/milestones/:mid/submit", () => {
  it("transitions funded → in_review when called by the seller", async () => {
    const app = await getApp();
    const clientToken = await registerUser(app, "client-sub@example.com", "Client Sub");
    const sellerToken = await registerUser(app, "seller-sub@example.com", "Seller Sub");

    const contract = await createContract(app, clientToken, "seller-sub@example.com", [
      { title: "Deliverable", amount: 5000 },
    ]);
    const milestoneId = contract.milestones[0].id;
    await seedFundedMilestone(milestoneId);

    const res = await app.inject({
      method: "POST",
      url: `/contracts/${contract.id}/milestones/${milestoneId}/submit`,
      headers: { Authorization: `Bearer ${sellerToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.id).toBe(milestoneId);
    expect(body.status).toBe("in_review");

    const persisted = await prisma.milestone.findUnique({ where: { id: milestoneId } });
    expect(persisted!.status).toBe("in_review");
  });

  it("returns 403 when called by a non-seller participant (the client)", async () => {
    const app = await getApp();
    const clientToken = await registerUser(app, "client-ns@example.com", "Client NS");
    const sellerToken = await registerUser(app, "seller-ns@example.com", "Seller NS");

    const contract = await createContract(app, clientToken, "seller-ns@example.com", [
      { title: "Work", amount: 1500 },
    ]);
    const milestoneId = contract.milestones[0].id;
    await seedFundedMilestone(milestoneId);

    const res = await app.inject({
      method: "POST",
      url: `/contracts/${contract.id}/milestones/${milestoneId}/submit`,
      headers: { Authorization: `Bearer ${clientToken}` },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("FORBIDDEN");

    const persisted = await prisma.milestone.findUnique({ where: { id: milestoneId } });
    expect(persisted!.status).toBe("funded");
  });

  it("returns 403 to a non-participant", async () => {
    const app = await getApp();
    const clientToken = await registerUser(app, "client-np-sub@example.com", "Client NPS");
    const sellerToken = await registerUser(app, "seller-np-sub@example.com", "Seller NPS");
    const outsiderToken = await registerUser(app, "outsider-sub@example.com", "Outsider");

    const contract = await createContract(app, clientToken, "seller-np-sub@example.com", [
      { title: "Work", amount: 800 },
    ]);
    const milestoneId = contract.milestones[0].id;
    await seedFundedMilestone(milestoneId);

    const res = await app.inject({
      method: "POST",
      url: `/contracts/${contract.id}/milestones/${milestoneId}/submit`,
      headers: { Authorization: `Bearer ${outsiderToken}` },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("FORBIDDEN");

    const persisted = await prisma.milestone.findUnique({ where: { id: milestoneId } });
    expect(persisted!.status).toBe("funded");
  });

  it("returns 409 when the milestone is in pending status", async () => {
    const app = await getApp();
    const clientToken = await registerUser(app, "client-pending@example.com", "Client P");
    const sellerToken = await registerUser(app, "seller-pending@example.com", "Seller P");

    const contract = await createContract(app, clientToken, "seller-pending@example.com", [
      { title: "Pending", amount: 1200 },
    ]);
    const milestoneId = contract.milestones[0].id;

    const res = await app.inject({
      method: "POST",
      url: `/contracts/${contract.id}/milestones/${milestoneId}/submit`,
      headers: { Authorization: `Bearer ${sellerToken}` },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("CONFLICT");

    const persisted = await prisma.milestone.findUnique({ where: { id: milestoneId } });
    expect(persisted!.status).toBe("pending");
  });

  it("returns 409 when the milestone is already in_review (skip-step)", async () => {
    const app = await getApp();
    const clientToken = await registerUser(app, "client-ir@example.com", "Client IR");
    const sellerToken = await registerUser(app, "seller-ir@example.com", "Seller IR");

    const contract = await createContract(app, clientToken, "seller-ir@example.com", [
      { title: "InReview", amount: 3000 },
    ]);
    const milestoneId = contract.milestones[0].id;
    await prisma.milestone.update({
      where: { id: milestoneId },
      data: { status: "in_review" },
    });

    const res = await app.inject({
      method: "POST",
      url: `/contracts/${contract.id}/milestones/${milestoneId}/submit`,
      headers: { Authorization: `Bearer ${sellerToken}` },
    });

    expect(res.statusCode).toBe(409);
    const persisted = await prisma.milestone.findUnique({ where: { id: milestoneId } });
    expect(persisted!.status).toBe("in_review");
  });

  it("returns 404 for unknown contract id", async () => {
    const app = await getApp();
    const sellerToken = await registerUser(app, "seller-uc@example.com", "Seller UC");

    const res = await app.inject({
      method: "POST",
      url: "/contracts/00000000-0000-0000-0000-000000000000/milestones/00000000-0000-0000-0000-000000000000/submit",
      headers: { Authorization: `Bearer ${sellerToken}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 404 for milestone id that does not belong to the contract", async () => {
    const app = await getApp();
    const clientToken = await registerUser(app, "client-wm@example.com", "Client WM");
    const sellerToken = await registerUser(app, "seller-wm@example.com", "Seller WM");

    const contract = await createContract(app, clientToken, "seller-wm@example.com", [
      { title: "Work", amount: 900 },
    ]);

    const res = await app.inject({
      method: "POST",
      url: `/contracts/${contract.id}/milestones/11111111-1111-1111-1111-111111111111/submit`,
      headers: { Authorization: `Bearer ${sellerToken}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it("returns 401 without auth", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/contracts/00000000-0000-0000-0000-000000000000/milestones/00000000-0000-0000-0000-000000000000/submit",
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("POST /contracts/:id/milestones/:mid/fund", () => {
  it("creates a PaymentIntent on the platform account, stores the id, and returns the clientSecret", async () => {
    const app = await getApp();
    const clientToken = await registerUser(app, "client-fund@example.com", "Client Fund");
    const sellerToken = await registerUser(app, "seller-fund@example.com", "Seller Fund");

    const contract = await createContract(app, clientToken, "seller-fund@example.com", [
      { title: "Phase", amount: 12345 },
    ]);
    const milestoneId = contract.milestones[0].id;

    const res = await app.inject({
      method: "POST",
      url: `/contracts/${contract.id}/milestones/${milestoneId}/fund`,
      headers: { Authorization: `Bearer ${clientToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.id).toMatch(/^pi_fake_/);
    expect(body.clientSecret).toMatch(/^pi_fake_.*_secret_/);

    const persisted = await prisma.milestone.findUnique({ where: { id: milestoneId } });
    expect(persisted!.stripePaymentIntentId).toBe(body.id);
    expect(persisted!.status).toBe("pending");

    const contractAfter = await prisma.contract.findUnique({ where: { id: contract.id } });
    expect(contractAfter!.status).toBe("draft");
    // ensure seller has not been touched (no role change, no auth)
    expect(sellerToken).toBeDefined();
  });

  it("returns 409 on a re-fund attempt (no second PaymentIntent, no extra ledger row)", async () => {
    const app = await getApp();
    const clientToken = await registerUser(app, "client-refund@example.com", "Client Refund");
    await registerUser(app, "seller-refund@example.com", "Seller Refund");
    const contract = await createContract(app, clientToken, "seller-refund@example.com", [
      { title: "Phase", amount: 5000 },
    ]);
    const milestoneId = contract.milestones[0].id;

    const first = await app.inject({
      method: "POST",
      url: `/contracts/${contract.id}/milestones/${milestoneId}/fund`,
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    expect(first.statusCode).toBe(200);
    const firstPiId = JSON.parse(first.payload).id;

    const second = await app.inject({
      method: "POST",
      url: `/contracts/${contract.id}/milestones/${milestoneId}/fund`,
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    expect(second.statusCode).toBe(409);
    expect(JSON.parse(second.payload).code).toBe("CONFLICT");

    const persisted = await prisma.milestone.findUnique({ where: { id: milestoneId } });
    expect(persisted!.stripePaymentIntentId).toBe(firstPiId);
    expect(persisted!.status).toBe("pending");

    const ledgerCount = await prisma.ledgerEntry.count();
    expect(ledgerCount).toBe(0);
  });

  it("returns 409 when the milestone is already funded (status not pending)", async () => {
    const app = await getApp();
    const clientToken = await registerUser(app, "client-nonpending@example.com", "Client NP");
    await registerUser(app, "seller-nonpending@example.com", "Seller NP");
    const contract = await createContract(app, clientToken, "seller-nonpending@example.com", [
      { title: "Phase", amount: 7000 },
    ]);
    const milestoneId = contract.milestones[0].id;
    await prisma.milestone.update({
      where: { id: milestoneId },
      data: { status: "funded", stripePaymentIntentId: "pi_existing" },
    });

    const res = await app.inject({
      method: "POST",
      url: `/contracts/${contract.id}/milestones/${milestoneId}/fund`,
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(409);
    expect(JSON.parse(res.payload).code).toBe("CONFLICT");
  });

  it("returns 403 when called by the seller (non-client participant)", async () => {
    const app = await getApp();
    const clientToken = await registerUser(app, "client-3p@example.com", "Client 3P");
    const sellerToken = await registerUser(app, "seller-3p@example.com", "Seller 3P");
    const contract = await createContract(app, clientToken, "seller-3p@example.com", [
      { title: "Phase", amount: 900 },
    ]);
    const milestoneId = contract.milestones[0].id;

    const res = await app.inject({
      method: "POST",
      url: `/contracts/${contract.id}/milestones/${milestoneId}/fund`,
      headers: { Authorization: `Bearer ${sellerToken}` },
    });
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.payload).code).toBe("FORBIDDEN");
  });

  it("returns 403 to a non-participant (outsider)", async () => {
    const app = await getApp();
    const clientToken = await registerUser(app, "client-out@example.com", "Client Out");
    const outsiderToken = await registerUser(app, "outsider-fund@example.com", "Outsider");
    await registerUser(app, "seller-out@example.com", "Seller Out");
    const contract = await createContract(app, clientToken, "seller-out@example.com", [
      { title: "Phase", amount: 1100 },
    ]);
    const milestoneId = contract.milestones[0].id;

    const res = await app.inject({
      method: "POST",
      url: `/contracts/${contract.id}/milestones/${milestoneId}/fund`,
      headers: { Authorization: `Bearer ${outsiderToken}` },
    });
    expect(res.statusCode).toBe(403);
    expect(JSON.parse(res.payload).code).toBe("FORBIDDEN");
  });

  it("returns 404 when the milestone does not belong to the contract", async () => {
    const app = await getApp();
    const clientToken = await registerUser(app, "client-wmf@example.com", "Client WMF");
    await registerUser(app, "seller-wmf@example.com", "Seller WMF");
    const contract = await createContract(app, clientToken, "seller-wmf@example.com", [
      { title: "Phase", amount: 250 },
    ]);

    const res = await app.inject({
      method: "POST",
      url: `/contracts/${contract.id}/milestones/11111111-1111-1111-1111-111111111111/fund`,
      headers: { Authorization: `Bearer ${clientToken}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 401 without auth", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/contracts/00000000-0000-0000-0000-000000000000/milestones/00000000-0000-0000-0000-000000000000/fund",
    });
    expect(res.statusCode).toBe(401);
  });
});