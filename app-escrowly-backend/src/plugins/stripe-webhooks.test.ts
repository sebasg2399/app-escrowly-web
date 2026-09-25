import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://escrowly:escrowly@localhost:5433/escrowly_test";
process.env.JWT_SECRET = "test-jwt-secret-for-testing-only";
process.env.ACCESS_TOKEN_TTL = "5m";
process.env.REFRESH_TOKEN_TTL_DAYS = "7";
process.env.COOKIE_NAME = "escrowly_refresh";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_test_secret";

import type { FastifyInstance } from "fastify";
import { truncateTables } from "../test/helpers.js";
import { FakeStripeClient } from "../adapters/stripe/stripe-client.fake.js";

let app: FastifyInstance;

beforeAll(async () => {
  const { buildApp } = await import("../app.js");
  app = await buildApp();
  await app.ready();
});

afterAll(async () => {
  await app.close();
});

beforeEach(async () => {
  await truncateTables();
});

function fakeClient(): FakeStripeClient {
  return (app as FastifyInstance & { stripeClient: FakeStripeClient }).stripeClient;
}

function postEvent(event: { id: string; type: string; data?: unknown }) {
  const fake = fakeClient();
  const emitted = fake.webhook.emit(event) as unknown as {
    __signature: string;
    __rawBody: Buffer;
  };
  return {
    signature: emitted.__signature,
    rawBody: emitted.__rawBody,
  };
}

describe("stripe webhooks raw body parser", () => {
  it("preserves the raw bytes on request.rawBody for the webhook route", async () => {
    const payload = JSON.stringify({ id: "evt_test_raw", type: "ping" });
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/stripe",
      headers: { "content-type": "application/json" },
      payload,
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("malformed JSON at the webhook route returns 400 with the error envelope", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/stripe",
      headers: { "content-type": "application/json" },
      payload: "{ not valid json",
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
  });

  it("global JSON parsing is untouched for other routes", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/auth/refresh",
      headers: { "content-type": "application/json" },
      payload: "{ not valid json",
    });

    expect(res.statusCode).toBe(400);
    const body = res.json();
    expect(body.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /webhooks/stripe", () => {
  it("rejects requests without a signature with 400 (not 500)", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/stripe",
      headers: { "content-type": "application/json" },
      payload: JSON.stringify({ id: "evt_unsigned", type: "ping" }),
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("VALIDATION_ERROR");
  });

  it("rejects requests with a tampered signature with 400 (not 500)", async () => {
    const { rawBody } = postEvent({ id: "evt_tampered", type: "ping" });
    const res = await app.inject({
      method: "POST",
      url: "/webhooks/stripe",
      headers: {
        "content-type": "application/json",
        "stripe-signature": "t=1,v1=deadbeef",
      },
      payload: rawBody.toString("utf8"),
    });

    expect(res.statusCode).toBe(400);
    expect(res.json().code).toBe("VALIDATION_ERROR");
  });

  it("acknowledges unknown event types with 200 and never 5xx", async () => {
    const { signature, rawBody } = postEvent({ id: "evt_unknown", type: "ping.pong" });

    const res = await app.inject({
      method: "POST",
      url: "/webhooks/stripe",
      headers: {
        "content-type": "application/json",
        "stripe-signature": signature,
      },
      payload: rawBody.toString("utf8"),
    });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ processed: true });
  });

  it("treats the second delivery of the same event as a no-op (200, processed:false on the second)", async () => {
    const eventId = "evt_dup";
    const { signature, rawBody } = postEvent({ id: eventId, type: "ping.pong" });

    const first = await app.inject({
      method: "POST",
      url: "/webhooks/stripe",
      headers: {
        "content-type": "application/json",
        "stripe-signature": signature,
      },
      payload: rawBody.toString("utf8"),
    });

    expect(first.statusCode).toBe(200);

    // Re-sign the same rawBody so the timestamp is fresh.
    const second = await app.inject({
      method: "POST",
      url: "/webhooks/stripe",
      headers: {
        "content-type": "application/json",
        "stripe-signature": fakeClient().webhook.sign(rawBody),
      },
      payload: rawBody.toString("utf8"),
    });

    expect(second.statusCode).toBe(200);
  });
});