import type { PrismaClient } from "@prisma/client";
import type { Milestone } from "@prisma/client";
import type { ContractRepository } from "../../ports/contract-repository.js";
import type { LedgerRepository } from "../../ports/ledger-repository.js";
import type { MilestoneRepository } from "../../ports/milestone-repository.js";
import type { StripeClient } from "../../ports/stripe-client.js";
import type { UserRepository } from "../../ports/user-repository.js";
import { splitCommission } from "../payments/commission.js";

function notFound(message: string): Error & { statusCode: number; code: string } {
  const err = new Error(message) as Error & { statusCode: number; code: string };
  err.statusCode = 404;
  err.code = "NOT_FOUND";
  return err;
}

function forbidden(message: string): Error & { statusCode: number; code: string } {
  const err = new Error(message) as Error & { statusCode: number; code: string };
  err.statusCode = 403;
  err.code = "FORBIDDEN";
  return err;
}

function conflict(message: string): Error & { statusCode: number; code: string } {
  const err = new Error(message) as Error & { statusCode: number; code: string };
  err.statusCode = 409;
  err.code = "CONFLICT";
  return err;
}

function upstream(message: string): Error & { statusCode: number; code: string } {
  const err = new Error(message) as Error & { statusCode: number; code: string };
  err.statusCode = 502;
  err.code = "UPSTREAM_ERROR";
  return err;
}

export interface FundResult {
  id: string;
  clientSecret: string;
}

export class MilestonesService {
  constructor(
    private contracts: ContractRepository,
    private milestones: MilestoneRepository,
    private users: UserRepository,
    private ledger: LedgerRepository,
    private stripeClient: StripeClient,
    private prisma: PrismaClient,
  ) {}

  async submit(contractId: string, milestoneId: string, userId: string): Promise<Milestone> {
    const contract = await this.contracts.findById(contractId);
    if (!contract) {
      throw notFound("Contract not found");
    }
    if (contract.clientId !== userId && contract.sellerId !== userId) {
      throw forbidden("Not a participant of this contract");
    }
    if (contract.sellerId !== userId) {
      throw forbidden("Only the seller can submit a milestone");
    }
    const milestone = await this.milestones.findById(milestoneId);
    if (!milestone || milestone.contractId !== contractId) {
      throw notFound("Milestone not found");
    }
    const updated = await this.milestones.transitionStatusIf(
      milestoneId,
      "funded",
      "in_review",
    );
    if (!updated) {
      throw conflict("Milestone cannot be submitted in its current status");
    }
    return updated;
  }

  async fund(contractId: string, milestoneId: string, userId: string): Promise<FundResult> {
    const contract = await this.contracts.findById(contractId);
    if (!contract) {
      throw notFound("Contract not found");
    }
    if (contract.clientId !== userId && contract.sellerId !== userId) {
      throw forbidden("Not a participant of this contract");
    }
    if (contract.clientId !== userId) {
      throw forbidden("Only the client can fund a milestone");
    }
    const milestone = await this.milestones.findById(milestoneId);
    if (!milestone || milestone.contractId !== contractId) {
      throw notFound("Milestone not found");
    }
    if (milestone.status !== "pending") {
      throw conflict("Milestone cannot be funded in its current status");
    }
    if (milestone.stripePaymentIntentId) {
      throw conflict("Milestone already has a PaymentIntent");
    }

    const intent = await this.stripeClient.createPaymentIntent({
      amount: milestone.amount,
      currency: milestone.currency,
      idempotencyKey: `fund:${milestoneId}`,
      metadata: { milestoneId, contractId },
    });

    await this.prisma.$transaction((tx) =>
      this.milestones.setStripePaymentIntentId(milestoneId, intent.id, tx),
    );

    return { id: intent.id, clientSecret: intent.clientSecret };
  }

  /**
   * Client-driven approval + payout. Splits the milestone amount between a
   * 10% platform commission and a 90% Stripe Transfer to the seller. If the
   * seller cannot receive funds or the Transfer fails, the milestone stays
   * in `approved` and no seller-side ledger is written.
   *
   * Flow:
   *   1. authz + atomic `in_review → approved`
   *   2. splitCommission → createTransfer (outside the DB tx)
   *   3. ONE $transaction: `approved → paid` + commission + transfer ledger
   *      rows; `active → completed` when this was the last unpaid milestone.
   */
  async approve(contractId: string, milestoneId: string, userId: string): Promise<Milestone> {
    const contract = await this.contracts.findById(contractId);
    if (!contract) {
      throw notFound("Contract not found");
    }
    if (contract.clientId !== userId && contract.sellerId !== userId) {
      throw forbidden("Not a participant of this contract");
    }
    if (contract.clientId !== userId) {
      throw forbidden("Only the client can approve a milestone");
    }

    const milestone = await this.milestones.findById(milestoneId);
    if (!milestone || milestone.contractId !== contractId) {
      throw notFound("Milestone not found");
    }
    if (milestone.status === "paid") {
      throw conflict("Milestone is already paid");
    }

    // Step 1: move the milestone into `approved`. A milestone already in
    // `approved` is a RETRY of a payout that previously failed (for example
    // the seller had not connected an account yet) — allow it so the payout
    // can complete once the seller onboards. Idempotency (Stripe idempotency
    // key + unique ledger keys) prevents any double transfer.
    if (milestone.status === "in_review") {
      const approved = await this.milestones.transitionStatusIf(
        milestoneId,
        "in_review",
        "approved",
      );
      if (!approved) {
        throw conflict("Milestone cannot be approved in its current status");
      }
    } else if (milestone.status !== "approved") {
      throw conflict("Milestone cannot be approved in its current status");
    }

    // Step 2: confirm the seller can receive the Transfer.
    const seller = await this.users.findById(contract.sellerId);
    if (!seller) {
      throw notFound("Seller not found");
    }
    if (!seller.stripeAccountId) {
      throw conflict("Seller has no connected account for payouts");
    }
    if (!seller.stripeAccountPayoutsEnabled) {
      throw upstream("Seller's payouts are not enabled");
    }

    // Step 3: split + Transfer (outside the DB tx — Stripe is the chokepoint).
    const { commission, transfer } = splitCommission(milestone.amount);
    let transferId: string;
    try {
      const result = await this.stripeClient.createTransfer({
        amount: transfer,
        currency: milestone.currency,
        destination: seller.stripeAccountId,
        idempotencyKey: `transfer:${milestoneId}`,
        metadata: { milestoneId, contractId },
      });
      transferId = result.id;
    } catch (err) {
      const reason = (err as Error)?.message ?? "Stripe transfer failed";
      throw upstream(`Stripe transfer failed: ${reason}`);
    }

    // Step 4: ONE $transaction — `approved → paid`, ledger rows, contract completion.
    await this.prisma.$transaction(async (tx) => {
      const paid = await this.milestones.transitionStatusIf(
        milestoneId,
        "approved",
        "paid",
        { paidAt: new Date(), stripeTransferId: transferId },
        tx,
      );
      if (!paid) {
        throw new Error("Milestone failed to transition approved → paid");
      }

      await this.ledger.create(
        {
          milestoneId,
          contractId,
          kind: "commission_credit",
          side: "credit",
          amount: commission,
          currency: milestone.currency,
          reference: transferId,
          idempotencyKey: `transfer:${milestoneId}:comm`,
        },
        tx,
      );
      await this.ledger.create(
        {
          milestoneId,
          contractId,
          kind: "transfer_credit",
          side: "credit",
          amount: transfer,
          currency: milestone.currency,
          reference: transferId,
          idempotencyKey: `transfer:${milestoneId}:xf`,
        },
        tx,
      );

      const paidCount = await tx.milestone.count({
        where: { contractId, status: "paid" },
      });
      const totalCount = await tx.milestone.count({ where: { contractId } });
      if (paidCount === totalCount) {
        await this.contracts.transitionStatusIf(contractId, "active", "completed", tx);
      }
    });

    const updated = await this.milestones.findById(milestoneId);
    if (!updated) {
      throw notFound("Milestone disappeared after approval");
    }
    return updated;
  }
}
