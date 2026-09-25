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

// Import buildApp as a factory — each test gets a fresh instance
let buildApp: () => Promise<FastifyInstance>;

beforeEach(async () => {
  // Import dynamically to get a fresh buildApp each time
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

function getAccessToken(response: any): string {
  return JSON.parse(response.payload).accessToken;
}

function getRefreshCookie(response: any): string | undefined {
  const cookies = response.cookies;
  const cookie = cookies.find((c: any) => c.name === "escrowly_refresh");
  return cookie?.value;
}

describe("POST /auth/register", () => {
  it("returns 201 + accessToken + refresh cookie on success", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "Test User",
        email: "test@example.com",
        password: "SecurePass1",
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.payload);
    expect(body.accessToken).toBeDefined();
    expect(body.code).toBeUndefined();

    const cookie = getRefreshCookie(res);
    expect(cookie).toBeDefined();
    expect(cookie).toContain(".");
  });

  it("returns 409 on duplicate email", async () => {
    const app = await getApp();
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "Dup User",
        email: "dup@example.com",
        password: "SecurePass1",
      },
    });

    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "Dup User 2",
        email: "dup@example.com",
        password: "SecurePass1",
      },
    });

    expect(res.statusCode).toBe(409);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("CONFLICT");
  });

  it("returns 400 with field details on weak password", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "Weak User",
        email: "weak@example.com",
        password: "weak",
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("VALIDATION_ERROR");
    expect(body.details).toBeDefined();
    expect(body.details.password).toBeDefined();
  });

  it("returns 400 on missing email", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "No Email",
        password: "SecurePass1",
      },
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /auth/login", () => {
  it("returns 200 + accessToken + refresh cookie on success", async () => {
    const app = await getApp();
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "Login User",
        email: "login@example.com",
        password: "SecurePass1",
      },
    });

    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "login@example.com",
        password: "SecurePass1",
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.accessToken).toBeDefined();

    const cookie = getRefreshCookie(res);
    expect(cookie).toBeDefined();
  });

  it("returns 401 on wrong password", async () => {
    const app = await getApp();
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "Wrong User",
        email: "wrong@example.com",
        password: "SecurePass1",
      },
    });

    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "wrong@example.com",
        password: "WrongPass1",
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 on unknown email", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: {
        email: "nobody@example.com",
        password: "SecurePass1",
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("UNAUTHORIZED");
  });
});

describe("POST /auth/logout", () => {
  it("returns 204 and clears refresh cookie", async () => {
    const app = await getApp();
    const regRes = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "Logout User",
        email: "logout@example.com",
        password: "SecurePass1",
      },
    });

    const token = getAccessToken(regRes);

    const res = await app.inject({
      method: "POST",
      url: "/auth/logout",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(res.statusCode).toBe(204);
  });

  it("rejects access token after logout", async () => {
    const app = await getApp();
    const regRes = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "Logout 2 User",
        email: "logout2@example.com",
        password: "SecurePass1",
      },
    });

    const token = getAccessToken(regRes);

    await app.inject({
      method: "POST",
      url: "/auth/logout",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const res = await app.inject({
      method: "POST",
      url: "/auth/logout",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("UNAUTHORIZED");
  });
});

describe("POST /auth/refresh", () => {
  it("returns new accessToken + new refresh cookie", async () => {
    const app = await getApp();
    const regRes = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "Refresh User",
        email: "refresh@example.com",
        password: "SecurePass1",
      },
    });

    const oldToken = getAccessToken(regRes);
    const oldCookie = getRefreshCookie(regRes);

    const res = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      headers: {
        cookie: `escrowly_refresh=${oldCookie}`,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.accessToken).toBeDefined();
    expect(body.accessToken).not.toBe(oldToken);

    const newCookie = getRefreshCookie(res);
    expect(newCookie).toBeDefined();
    expect(newCookie).not.toBe(oldCookie);
  });

  it("returns 401 on missing refresh cookie", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/auth/refresh",
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 on invalid refresh cookie", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      headers: {
        cookie: "escrowly_refresh=invalid-format",
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 on revoked session refresh", async () => {
    const app = await getApp();
    const regRes = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        name: "Revoke User",
        email: "refresh-revoke@example.com",
        password: "SecurePass1",
      },
    });

    const token = getAccessToken(regRes);
    const cookie = getRefreshCookie(regRes);

    // Logout to revoke session
    await app.inject({
      method: "POST",
      url: "/auth/logout",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    // Try to refresh with revoked session
    const res = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      headers: {
        cookie: `escrowly_refresh=${cookie}`,
      },
    });

    expect(res.statusCode).toBe(401);
  });
});

describe("Expired/malformed token", () => {
  it("returns 401 on malformed token", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/auth/logout",
      headers: {
        Authorization: "Bearer not.a.valid.jwt",
      },
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("UNAUTHORIZED");
  });

  it("returns 401 on missing token", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/auth/logout",
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.payload);
    expect(body.code).toBe("UNAUTHORIZED");
  });
});

describe("Rate limiting", () => {
  it("returns 429 on excessive auth attempts", async () => {
    const app = await getApp();
    // Send many requests quickly to trigger rate limit
    const promises = Array.from({ length: 15 }, () =>
      app.inject({
        method: "POST",
        url: "/auth/login",
        payload: {
          email: "ratelimit@example.com",
          password: "wrong",
        },
      }),
    );

    const results = await Promise.all(promises);
    const rateLimited = results.find((r) => r.statusCode === 429);
    expect(rateLimited).toBeDefined();
    const body = JSON.parse(rateLimited!.payload);
    expect(body.code).toBe("RATE_LIMITED");
  });
});
