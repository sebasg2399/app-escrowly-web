import StripeLib from "stripe";
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

export interface CreateStripeClientOptions {
  apiKey: string;
  apiVersion: string;
}

export function createStripeClient(opts: CreateStripeClientOptions): StripeClient {
  const stripe = new StripeLib(opts.apiKey, {
    apiVersion: opts.apiVersion as StripeLib.LatestApiVersion,
  });

  return {
    async createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentResult> {
      const result = await stripe.paymentIntents.create(
        {
          amount: input.amount,
          currency: input.currency,
          metadata: input.metadata ?? {},
        },
        { idempotencyKey: input.idempotencyKey },
      );
      return { id: result.id, clientSecret: result.client_secret ?? "" };
    },

    async createExpressAccount(
      input: CreateExpressAccountInput,
    ): Promise<ExpressAccountResult> {
      const account = await stripe.accounts.create({
        type: "express",
        email: input.email,
        country: input.country,
        capabilities: {
          transfers: { requested: true },
          card_payments: { requested: true },
        },
        business_type: "individual",
        settings: {
          payouts: { schedule: { interval: "manual" } },
        },
      });
      return { id: account.id };
    },

    async createAccountLink(input: CreateAccountLinkInput): Promise<AccountLinkResult> {
      const link = await stripe.accountLinks.create({
        account: input.accountId,
        refresh_url: input.refreshUrl,
        return_url: input.returnUrl,
        type: "account_onboarding",
      });
      return { url: link.url };
    },

    async retrieveAccount(accountId: string): Promise<ConnectAccount> {
      const account = await stripe.accounts.retrieve(accountId);
      return {
        id: account.id,
        payoutsEnabled: Boolean(account.payouts_enabled),
        detailsSubmitted: Boolean(account.details_submitted),
        chargesEnabled: Boolean(account.charges_enabled),
      };
    },

    async createTransfer(input: CreateTransferInput): Promise<TransferResult> {
      const transfer = await stripe.transfers.create(
        {
          amount: input.amount,
          currency: input.currency,
          destination: input.destination,
          metadata: input.metadata ?? {},
        },
        { idempotencyKey: input.idempotencyKey },
      );
      return { id: transfer.id };
    },

    constructWebhookEvent(input: ConstructWebhookEventInput): WebhookEventLike {
      const event = stripe.webhooks.constructEvent(
        input.rawBody,
        input.signature,
        input.secret,
      );
      return {
        id: event.id,
        type: event.type,
        data: event.data as { object: unknown },
        created: event.created,
      };
    },
  };
}
