import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import {
  AccountLinkResult,
  ConnectAccount,
  ConstructWebhookEventInput,
  CreateAccountLinkInput,
  CreateExpressAccountInput,
  CreatePaymentIntentInput,
  CreateTransferInput,
  ExpressAccountResult,
  PaymentIntentResult,
  StripeClient,
  TransferResult,
  WebhookEventLike,
} from "../../ports/stripe-client.js";

/**
 * In-memory Stripe client used by tests. State is held in maps; the fake
 * supports deterministic ids and a controllable webhook event emitter.
 */
export interface FakeStripeClient extends StripeClient {
  webhook: {
    setSecret(secret: string): void;
    sign(rawBody: Buffer, timestamp?: number): string;
    emit(event: { id: string; type: string; data?: unknown }): WebhookEventLike;
  };
  reset(): void;
}

interface PiRecord {
  id: string;
  clientSecret: string;
  amount: number;
  metadata: Record<string, string>;
}

interface TransferRecord {
  id: string;
  amount: number;
  destination: string;
  metadata: Record<string, string>;
}

function newId(prefix: string): string {
  return `${prefix}_${randomBytes(8).toString("hex")}`;
}

function buildAccount(id: string): ConnectAccount {
  return {
    id,
    payoutsEnabled: true,
    detailsSubmitted: true,
    chargesEnabled: true,
  };
}

export function createFakeStripeClient(): FakeStripeClient {
  const paymentIntents = new Map<string, PiRecord>();
  const transfers = new Map<string, TransferRecord>();
  const accounts = new Map<string, ConnectAccount>();
  const idemKeys = new Set<string>();
  let webhookSecret: string | null = null;

  function reserveIdempotency(key: string): boolean {
    if (idemKeys.has(key)) return false;
    idemKeys.add(key);
    return true;
  }

  function signBody(rawBody: Buffer, timestamp: number, secret: string): string {
    const payload = `${timestamp}.${rawBody.toString("utf8")}`;
    const sig = createHmac("sha256", secret).update(payload).digest("hex");
    return `t=${timestamp},v1=${sig}`;
  }

  function verifySignature(
    rawBody: Buffer,
    signatureHeader: string,
    secret: string,
  ): { timestamp: number } {
    if (!webhookSecret || !signatureHeader) {
      throw new Error("Missing signature header");
    }
    const parts = Object.fromEntries(
      signatureHeader.split(",").map((kv) => {
        const [k, ...rest] = kv.split("=");
        return [k, rest.join("=")];
      }),
    );
    const timestamp = Number(parts.t);
    const provided = parts.v1;
    if (!timestamp || !provided) throw new Error("Invalid signature header");

    const expected = createHmac("sha256", secret)
      .update(`${timestamp}.${rawBody.toString("utf8")}`)
      .digest("hex");
    const expectedBuf = Buffer.from(expected, "hex");
    const providedBuf = Buffer.from(provided, "hex");
    if (
      expectedBuf.length !== providedBuf.length ||
      !timingSafeEqual(expectedBuf, providedBuf)
    ) {
      throw new Error("Signature does not match");
    }
    return { timestamp };
  }

  const client: FakeStripeClient = {
    async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentResult> {
      if (!reserveIdempotency(input.idempotencyKey)) {
        const existing = [...paymentIntents.values()].find((pi) =>
          Object.values(input.metadata ?? {}).every((v) =>
            Object.values(pi.metadata).includes(v),
          ),
        );
        if (existing) return { id: existing.id, clientSecret: existing.clientSecret };
      }
      const id = newId("pi_fake");
      const clientSecret = `${id}_secret_${randomBytes(6).toString("hex")}`;
      const record: PiRecord = {
        id,
        clientSecret,
        amount: input.amount,
        metadata: input.metadata ?? {},
      };
      paymentIntents.set(id, record);
      return { id, clientSecret };
    },

    async createExpressAccount(
      input: CreateExpressAccountInput,
    ): Promise<ExpressAccountResult> {
      const id = newId("acct_fake");
      accounts.set(id, buildAccount(id));
      return { id };
    },

    async createAccountLink(input: CreateAccountLinkInput): Promise<AccountLinkResult> {
      if (!accounts.has(input.accountId)) {
        accounts.set(input.accountId, buildAccount(input.accountId));
      }
      return {
        url: `https://stripe.test/connect/onboarding/${input.accountId}`,
      };
    },

    async retrieveAccount(accountId: string): Promise<ConnectAccount> {
      let account = accounts.get(accountId);
      if (!account) {
        account = buildAccount(accountId);
        accounts.set(accountId, account);
      }
      return account;
    },

    async createTransfer(input: CreateTransferInput): Promise<TransferResult> {
      if (!reserveIdempotency(input.idempotencyKey)) {
        const existing = [...transfers.values()].find(
          (t) => t.amount === input.amount && t.destination === input.destination,
        );
        if (existing) return { id: existing.id };
      }
      const id = newId("tr_fake");
      transfers.set(id, {
        id,
        amount: input.amount,
        destination: input.destination,
        metadata: input.metadata ?? {},
      });
      return { id };
    },

    constructWebhookEvent(input: ConstructWebhookEventInput): WebhookEventLike {
      if (!webhookSecret) throw new Error("Webhook secret not configured on fake");
      verifySignature(input.rawBody, input.signature, webhookSecret);
      const parsed = JSON.parse(input.rawBody.toString("utf8")) as {
        id: string;
        type: string;
        data?: { object?: unknown };
        created?: number;
      };
      return {
        id: parsed.id,
        type: parsed.type,
        data: { object: parsed.data?.object ?? null },
        created: parsed.created ?? Math.floor(Date.now() / 1000),
      };
    },

    webhook: {
      setSecret(secret: string) {
        webhookSecret = secret;
      },
      sign(rawBody: Buffer, timestamp?: number) {
        if (!webhookSecret) throw new Error("Webhook secret not configured on fake");
        return signBody(rawBody, timestamp ?? Math.floor(Date.now() / 1000), webhookSecret);
      },
      emit(event: { id: string; type: string; data?: unknown }): WebhookEventLike {
        if (!webhookSecret) throw new Error("Webhook secret not configured on fake");
        const created = Math.floor(Date.now() / 1000);
        const rawBody = Buffer.from(
          JSON.stringify({ id: event.id, type: event.type, data: { object: event.data ?? null }, created }),
          "utf8",
        );
        const signature = signBody(rawBody, created, webhookSecret);
        return {
          id: event.id,
          type: event.type,
          data: { object: event.data ?? null },
          created,
          // Surface for callers that want to relay it.
          ...({ __signature: signature, __rawBody: rawBody } as Record<string, unknown>),
        };
      },
    },

    reset() {
      paymentIntents.clear();
      transfers.clear();
      accounts.clear();
      idemKeys.clear();
    },
  };

  return client;
}
