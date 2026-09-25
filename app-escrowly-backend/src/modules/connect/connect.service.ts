import type { PrismaClient } from "@prisma/client";
import type { StripeClient } from "../../ports/stripe-client.js";
import type { UserRepository } from "../../ports/user-repository.js";
import { env } from "../../config/env.js";

export interface OnboardingLinkResult {
  url: string;
}

export interface OnboardingStatus {
  hasAccount: boolean;
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
  onboardingComplete: boolean;
}

function missingConfigError(message: string): Error & {
  statusCode: number;
  code: string;
} {
  const err = new Error(message) as Error & {
    statusCode: number;
    code: string;
  };
  err.statusCode = 500;
  err.code = "INTERNAL";
  return err;
}

/**
 * Stripe Connect Express onboarding. Any authenticated user MAY onboard —
 * a given user can be a client in one contract and the seller in another,
 * so the role gate from the original spec was loosened. The flag returned by
 * `GET /connect/status` reflects the user's own stored onboarding state.
 */
export class ConnectService {
  constructor(
    private users: UserRepository,
    private stripeClient: StripeClient,
    private prisma: PrismaClient,
  ) {}

  async createOnboardingLink(userId: string): Promise<OnboardingLinkResult> {
    const user = await this.users.findById(userId);
    if (!user) {
      const err = new Error("User not found") as Error & {
        statusCode: number;
        code: string;
      };
      err.statusCode = 404;
      err.code = "NOT_FOUND";
      throw err;
    }

    const refreshUrl = env.STRIPE_CONNECT_REFRESH_URL;
    const returnUrl = env.STRIPE_CONNECT_RETURN_URL;
    if (!refreshUrl || !returnUrl) {
      throw missingConfigError(
        "Stripe Connect URLs are not configured (STRIPE_CONNECT_REFRESH_URL / STRIPE_CONNECT_RETURN_URL)",
      );
    }

    const existingAccountId = user.stripeAccountId;
    const accountId =
      existingAccountId ??
      (
        await this.stripeClient.createExpressAccount({
          email: user.email,
          country: "US",
        })
      ).id;

    if (!existingAccountId) {
      await this.users.setStripeAccountId(userId, accountId);
    }

    const link = await this.stripeClient.createAccountLink({
      accountId,
      refreshUrl,
      returnUrl,
    });

    return { url: link.url };
  }

  async getStatus(userId: string): Promise<OnboardingStatus> {
    const user = await this.users.findById(userId);
    if (!user) {
      const err = new Error("User not found") as Error & {
        statusCode: number;
        code: string;
      };
      err.statusCode = 404;
      err.code = "NOT_FOUND";
      throw err;
    }

    if (!user.stripeAccountId) {
      return {
        hasAccount: false,
        detailsSubmitted: false,
        payoutsEnabled: false,
        onboardingComplete: false,
      };
    }

    const account = await this.stripeClient.retrieveAccount(user.stripeAccountId);
    const flags = {
      payoutsEnabled: account.payoutsEnabled,
      detailsSubmitted: account.detailsSubmitted,
    };

    if (
      flags.payoutsEnabled !== user.stripeAccountPayoutsEnabled ||
      flags.detailsSubmitted !== user.stripeAccountDetailsSubmitted
    ) {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          stripeAccountPayoutsEnabled: flags.payoutsEnabled,
          stripeAccountDetailsSubmitted: flags.detailsSubmitted,
        },
      });
    }

    return {
      hasAccount: true,
      detailsSubmitted: flags.detailsSubmitted,
      payoutsEnabled: flags.payoutsEnabled,
      onboardingComplete: flags.payoutsEnabled && flags.detailsSubmitted,
    };
  }
}
