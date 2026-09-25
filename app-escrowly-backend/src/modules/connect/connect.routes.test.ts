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
): Promise<{ token: string; userId: string }> {
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
  return { token: body.accessToken as string, userId: user!.id };
}

describe("POST /connect/onboarding-link", () => {
  it("creates a Connect Express account, stores it on the user, and returns a hosted URL", async () => {
    const { app, fake } = await getApp();
    const { token, userId } = await registerUser(app, "connect-new@example.com", "Connect New");

    const res = await app.inject({
      method: "POST",
      url: "/connect/onboarding-link",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.url).toMatch(/^https:\/\/stripe\.test\/connect\/onboarding\//);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user!.stripeAccountId).toBeTruthy();
    expect(user!.stripeAccountId).toMatch(/^acct_fake_/);

    expect([...fake.accounts.keys()]).toContain(user!.stripeAccountId);
  });

  it("reuses an existing account on subsequent calls (no duplicate create)", async () => {
    const { app, fake } = await getApp();
    const { token, userId } = await registerUser(app, "connect-reuse@example.com", "Connect Reuse");

    const first = await app.inject({
      method: "POST",
      url: "/connect/onboarding-link",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(first.statusCode).toBe(200);

    const user1 = await prisma.user.findUnique({ where: { id: userId } });
    const accountId = user1!.stripeAccountId;

    const second = await app.inject({
      method: "POST",
      url: "/connect/onboarding-link",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(second.statusCode).toBe(200);

    const user2 = await prisma.user.findUnique({ where: { id: userId } });
    expect(user2!.stripeAccountId).toBe(accountId);
  });

  it("returns 401 without auth", async () => {
    const { app } = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/connect/onboarding-link",
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("GET /connect/status", () => {
  it("returns hasAccount=false and all flags false for a user with no account", async () => {
    const { app } = await getApp();
    const { token } = await registerUser(app, "status-none@example.com", "Status None");

    const res = await app.inject({
      method: "GET",
      url: "/connect/status",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.payload)).toEqual({
      hasAccount: false,
      detailsSubmitted: false,
      payoutsEnabled: false,
      onboardingComplete: false,
    });
  });

  it("returns onboardingComplete=true after a fresh account is created (fake account is fully enabled)", async () => {
    const { app } = await getApp();
    const { token, userId } = await registerUser(app, "status-ok@example.com", "Status OK");

    // Trigger account creation.
    const linkRes = await app.inject({
      method: "POST",
      url: "/connect/onboarding-link",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(linkRes.statusCode).toBe(200);

    const statusRes = await app.inject({
      method: "GET",
      url: "/connect/status",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(statusRes.statusCode).toBe(200);
    const body = JSON.parse(statusRes.payload);
    expect(body).toEqual({
      hasAccount: true,
      detailsSubmitted: true,
      payoutsEnabled: true,
      onboardingComplete: true,
    });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    expect(user!.stripeAccountPayoutsEnabled).toBe(true);
    expect(user!.stripeAccountDetailsSubmitted).toBe(true);
  });

  it("refreshes the persisted flags from retrieveAccount when they drift", async () => {
    const { app, fake } = await getApp();
    const { token, userId } = await registerUser(app, "status-drift@example.com", "Status Drift");

    const linkRes = await app.inject({
      method: "POST",
      url: "/connect/onboarding-link",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(linkRes.statusCode).toBe(200);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const accountId = user!.stripeAccountId!;

    // Simulate Stripe advancing onboarding: only detailsSubmitted now, payouts not yet.
    fake.setAccountState?.(accountId, { payoutsEnabled: false, detailsSubmitted: true });

    const statusRes = await app.inject({
      method: "GET",
      url: "/connect/status",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(statusRes.statusCode).toBe(200);
    const body = JSON.parse(statusRes.payload);
    expect(body).toEqual({
      hasAccount: true,
      detailsSubmitted: true,
      payoutsEnabled: false,
      onboardingComplete: false,
    });

    const updated = await prisma.user.findUnique({ where: { id: userId } });
    expect(updated!.stripeAccountPayoutsEnabled).toBe(false);
    expect(updated!.stripeAccountDetailsSubmitted).toBe(true);
  });

  it("returns 401 without auth", async () => {
    const { app } = await getApp();
    const res = await app.inject({ method: "GET", url: "/connect/status" });
    expect(res.statusCode).toBe(401);
  });
});
