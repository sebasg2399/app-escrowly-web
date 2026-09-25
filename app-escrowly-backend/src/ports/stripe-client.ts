/**
 * Minimal Stripe client port. Mirrors only the use-cases the backend needs:
 * Connect Express onboarding, PaymentIntents, Transfers, and webhook
 * signature verification. Real adapter wraps the `stripe` SDK; the fake
 * adapter is used by tests.
 */

export interface CreatePaymentIntentInput {
  amount: number;
  currency: string;
  idempotencyKey: string;
  metadata?: Record<string, string>;
}

export interface PaymentIntentResult {
  id: string;
  clientSecret: string;
}

export interface CreateExpressAccountInput {
  email: string;
  country: string;
}

export interface ExpressAccountResult {
  id: string;
}

export interface CreateAccountLinkInput {
  accountId: string;
  refreshUrl: string;
  returnUrl: string;
}

export interface AccountLinkResult {
  url: string;
}

export interface ConnectAccount {
  id: string;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  chargesEnabled?: boolean;
}

export interface CreateTransferInput {
  amount: number;
  currency: string;
  destination: string;
  idempotencyKey: string;
  metadata?: Record<string, string>;
}

export interface TransferResult {
  id: string;
}

export interface ConstructWebhookEventInput {
  rawBody: Buffer;
  signature: string;
  secret: string;
}

export interface WebhookEventLike {
  id: string;
  type: string;
  data: { object: unknown };
  created: number;
}

export interface StripeClient {
  createPaymentIntent(input: CreatePaymentIntentInput): Promise<PaymentIntentResult>;
  createExpressAccount(input: CreateExpressAccountInput): Promise<ExpressAccountResult>;
  createAccountLink(input: CreateAccountLinkInput): Promise<AccountLinkResult>;
  retrieveAccount(accountId: string): Promise<ConnectAccount>;
  createTransfer(input: CreateTransferInput): Promise<TransferResult>;
  constructWebhookEvent(input: ConstructWebhookEventInput): WebhookEventLike;
}
