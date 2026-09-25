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

async function createUserAccount(
  app: FastifyInstance,
  email: string,
  name: string,
): Promise<string> {
  const token = await registerUser(app, email, name);
  const user = await prisma.user.findUnique({ where: { email } });
  return user!.id;
}

describe("POST /contracts", () => {
  it("creates a contract with milestones atomically", async () => {
    const app = await getApp();
    const clientToken = await registerUser(app, "client-ok@example.com", "Client OK");
    await createUserAccount(app, "seller-ok@example.com", "Seller OK");

    const res = await app.inject({
      method: "POST",
      url: "/contracts",
      headers: { Authorization: `Bearer ${clientToken}` },
      payload: {
        sellerEmail: "seller-ok@example.com",
        milestones: [
          { title: "Phase 1", amount: 10000 },
          { title: "Phase 2", amount: 20000 },
        ],
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.id).toBeDefined();
    expect(body.status).toBe("draft");
    expect(body.milestones).toHaveLength(2);
    expect(body.milestones[0].title).toBe("Phase 1");
    expect(body.milestones[0].amount).toBe(10000);
    expect(body.milestones[0].status).toBe("pending");
    expect(body.milestones[1].title).toBe("Phase 2");
    expect(body.milestones[1].amount).toBe(20000);
    expect(body.milestones[1].status).toBe("pending");

    const fetched = await prisma.contract.findUnique({
      where: { id: body.id },
      include: { milestones: { orderBy: { createdAt: "asc" } } },
    });
    expect(fetched).not.toBeNull();
    expect(fetched!.status).toBe("draft");
    expect(fetched!.milestones).toHaveLength(2);
  });

  it("rejects empty milestone list with 400", async () => {
    const app = await getApp();
    const token = await registerUser(app, "no-ms@example.com", "No Ms");
    await createUserAccount(app, "seller-no-ms@example.com", "Seller NM");

    const res = await app.inject({
      method: "POST",
      url: "/contracts",
      headers: { Authorization: `Bearer ${token}` },
      payload: { sellerEmail: "seller-no-ms@example.com", milestones: [] },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.details.milestones).toBeDefined();
  });

  it("rejects zero amount with 400", async () => {
    const app = await getApp();
    const token = await registerUser(app, "zero@example.com", "Zero");
    await createUserAccount(app, "seller-zero@example.com", "Seller Zero");

    const res = await app.inject({
      method: "POST",
      url: "/contracts",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        sellerEmail: "seller-zero@example.com",
        milestones: [{ title: "Zero", amount: 0 }],
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.details["milestones/0/amount"]).toBeDefined();
  });

  it("rejects negative amount with 400", async () => {
    const app = await getApp();
    const token = await registerUser(app, "neg@example.com", "Neg");
    await createUserAccount(app, "seller-neg@example.com", "Seller Neg");

    const res = await app.inject({
      method: "POST",
      url: "/contracts",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        sellerEmail: "seller-neg@example.com",
        milestones: [{ title: "Neg", amount: -100 }],
      },
    });

    expect(res.statusCode).toBe(400);
  });

  it("rejects non-integer amount with 400", async () => {
    const app = await getApp();
    const token = await registerUser(app, "float@example.com", "Float");
    await createUserAccount(app, "seller-float@example.com", "Seller Float");

    const res = await app.inject({
      method: "POST",
      url: "/contracts",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        sellerEmail: "seller-float@example.com",
        milestones: [{ title: "Float", amount: 1.5 }],
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("rejects empty title with 400", async () => {
    const app = await getApp();
    const token = await registerUser(app, "notitle@example.com", "NoTitle");
    await createUserAccount(app, "seller-nt@example.com", "Seller NT");

    const res = await app.inject({
      method: "POST",
      url: "/contracts",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        sellerEmail: "seller-nt@example.com",
        milestones: [{ title: "", amount: 1000 }],
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.details["milestones/0/title"]).toBeDefined();
  });

  it("rejects unknown seller email with 404", async () => {
    const app = await getApp();
    const token = await registerUser(app, "unk@example.com", "Unk");

    const res = await app.inject({
      method: "POST",
      url: "/contracts",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        sellerEmail: "ghost@example.com",
        milestones: [{ title: "t", amount: 100 }],
      },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("NOT_FOUND");
  });

  it("rejects self-seller with 400", async () => {
    const app = await getApp();
    const token = await registerUser(app, "self@example.com", "Self");

    const res = await app.inject({
      method: "POST",
      url: "/contracts",
      headers: { Authorization: `Bearer ${token}` },
      payload: {
        sellerEmail: "self@example.com",
        milestones: [{ title: "t", amount: 100 }],
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.details.sellerEmail).toBeDefined();
  });

  it("returns 401 without auth", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/contracts",
      payload: {
        sellerEmail: "someone@example.com",
        milestones: [{ title: "t", amount: 100 }],
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("UNAUTHORIZED");
  });
});

describe("GET /contracts", () => {
  it("returns only the caller's contracts", async () => {
    const app = await getApp();
    const clientToken = await registerUser(app, "client-list@example.com", "Client List");
    await createUserAccount(app, "seller-list@example.com", "Seller List");

    await app.inject({
      method: "POST",
      url: "/contracts",
      headers: { Authorization: `Bearer ${clientToken}` },
      payload: {
        sellerEmail: "seller-list@example.com",
        milestones: [{ title: "M1", amount: 100 }],
      },
    });

    const otherClient = await createUserAccount(app, "other-client@example.com", "Other Client");
    const otherSeller = await createUserAccount(app, "other-seller@example.com", "Other Seller");
    await prisma.contract.create({
      data: {
        clientId: otherClient,
        sellerId: otherSeller,
        milestones: { create: [{ title: "Other", amount: 200 }] },
      },
    });

    const res = await app.inject({
      method: "GET",
      url: "/contracts",
      headers: { Authorization: `Bearer ${clientToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveLength(1);
    expect(body[0].status).toBe("draft");
  });

  it("returns empty list for user with no contracts", async () => {
    const app = await getApp();
    const token = await registerUser(app, "empty@example.com", "Empty");

    const res = await app.inject({
      method: "GET",
      url: "/contracts",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload)).toEqual([]);
  });

  it("returns 401 without auth", async () => {
    const app = await getApp();
    const res = await app.inject({ method: "GET", url: "/contracts" });
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /contracts/:id", () => {
  it("returns the contract with milestones to the client", async () => {
    const app = await getApp();
    const clientToken = await registerUser(app, "client-get@example.com", "Client Get");
    await createUserAccount(app, "seller-get@example.com", "Seller Get");

    const createRes = await app.inject({
      method: "POST",
      url: "/contracts",
      headers: { Authorization: `Bearer ${clientToken}` },
      payload: {
        sellerEmail: "seller-get@example.com",
        milestones: [{ title: "Get", amount: 500 }],
      },
    });
    const created = JSON.parse(createRes.payload);

    const res = await app.inject({
      method: "GET",
      url: `/contracts/${created.id}`,
      headers: { Authorization: `Bearer ${clientToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.id).toBe(created.id);
    expect(body.milestones).toHaveLength(1);
    expect(body.milestones[0].title).toBe("Get");
  });

  it("returns the contract to the seller", async () => {
    const app = await getApp();
    const clientToken = await registerUser(app, "client-sg@example.com", "Client SG");
    const sellerToken = await registerUser(app, "seller-sg@example.com", "Seller SG");

    const createRes = await app.inject({
      method: "POST",
      url: "/contracts",
      headers: { Authorization: `Bearer ${clientToken}` },
      payload: {
        sellerEmail: "seller-sg@example.com",
        milestones: [{ title: "SG", amount: 700 }],
      },
    });
    const created = JSON.parse(createRes.payload);

    const res = await app.inject({
      method: "GET",
      url: `/contracts/${created.id}`,
      headers: { Authorization: `Bearer ${sellerToken}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload).id).toBe(created.id);
  });

  it("returns 403 to non-participant", async () => {
    const app = await getApp();
    const clientToken = await registerUser(app, "client-np@example.com", "Client NP");
    const otherToken = await registerUser(app, "outsider@example.com", "Outsider");
    await createUserAccount(app, "seller-np@example.com", "Seller NP");

    const createRes = await app.inject({
      method: "POST",
      url: "/contracts",
      headers: { Authorization: `Bearer ${clientToken}` },
      payload: {
        sellerEmail: "seller-np@example.com",
        milestones: [{ title: "NP", amount: 500 }],
      },
    });
    const created = JSON.parse(createRes.payload);

    const res = await app.inject({
      method: "GET",
      url: `/contracts/${created.id}`,
      headers: { Authorization: `Bearer ${otherToken}` },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("FORBIDDEN");
  });

  it("returns 404 for unknown contract id", async () => {
    const app = await getApp();
    const token = await registerUser(app, "unk-get@example.com", "Unk Get");

    const res = await app.inject({
      method: "GET",
      url: "/contracts/00000000-0000-0000-0000-000000000000",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("NOT_FOUND");
  });

  it("returns 401 without auth", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "GET",
      url: "/contracts/00000000-0000-0000-0000-000000000000",
    });
    expect(res.statusCode).toBe(401);
  });
});