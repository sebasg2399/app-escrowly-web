import { describe, it, expect, beforeEach, afterEach } from "vitest";

// Set test env BEFORE any module imports
process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://escrowly:escrowly@localhost:5433/escrowly_test";
process.env.JWT_SECRET = "test-jwt-secret-for-testing-only";
process.env.ACCESS_TOKEN_TTL = "5m";
process.env.REFRESH_TOKEN_TTL_DAYS = "7";
process.env.COOKIE_NAME = "escrowly_refresh";

import type { FastifyInstance } from "fastify";
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

async function registerAndGetToken(
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

describe("GET /users/me", () => {
  it("returns profile without passwordHash", async () => {
    const app = await getApp();
    const token = await registerAndGetToken(app, "profile@example.com", "Profile User");

    const res = await app.inject({
      method: "GET",
      url: "/users/me",
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.id).toBeDefined();
    expect(body.email).toBe("profile@example.com");
    expect(body.name).toBe("Profile User");
    expect(body.role).toBe("client");
    expect(body.passwordHash).toBeUndefined();
  });

  it("returns 401 without token", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "GET",
      url: "/users/me",
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("UNAUTHORIZED");
  });
});

describe("PATCH /users/me", () => {
  it("persists name update", async () => {
    const app = await getApp();
    const token = await registerAndGetToken(app, "update@example.com", "Old Name");

    const res = await app.inject({
      method: "PATCH",
      url: "/users/me",
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "New Name" },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.name).toBe("New Name");
    expect(body.passwordHash).toBeUndefined();

    // Verify persisted by fetching again
    const getRes = await app.inject({
      method: "GET",
      url: "/users/me",
      headers: { Authorization: `Bearer ${token}` },
    });
    const getBody = JSON.parse(getRes.payload);
    expect(getBody.name).toBe("New Name");
  });

  it("rejects role escalation with 403", async () => {
    const app = await getApp();
    const token = await registerAndGetToken(app, "escalate@example.com", "Escalator");

    const res = await app.inject({
      method: "PATCH",
      url: "/users/me",
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "Hacker", role: "admin" },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("FORBIDDEN");
    expect(body.details.role).toBeDefined();
  });

  it("rejects email change with 403", async () => {
    const app = await getApp();
    const token = await registerAndGetToken(app, "change-email@example.com", "Email Changer");

    const res = await app.inject({
      method: "PATCH",
      url: "/users/me",
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "New Name", email: "hacker@example.com" },
    });

    expect(res.statusCode).toBe(403);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("FORBIDDEN");
    expect(body.details.email).toBeDefined();
  });

  it("returns 400 on invalid name", async () => {
    const app = await getApp();
    const token = await registerAndGetToken(app, "bad-name@example.com", "Bad Name");

    const res = await app.inject({
      method: "PATCH",
      url: "/users/me",
      headers: { Authorization: `Bearer ${token}` },
      payload: { name: "" },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.details.name).toBeDefined();
  });

  it("returns 401 without token", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "PATCH",
      url: "/users/me",
      payload: { name: "No Auth" },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("UNAUTHORIZED");
  });
});
