import type { PrismaClient } from "@prisma/client";
import type { Milestone } from "@prisma/client";
import type { ContractRepository } from "../../ports/contract-repository.js";
import type { MilestoneRepository } from "../../ports/milestone-repository.js";
import type { StripeClient } from "../../ports/stripe-client.js";

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

export interface FundResult {
  id: string;
  clientSecret: string;
}

export class MilestonesService {
  constructor(
    private contracts: ContractRepository,
    private milestones: MilestoneRepository,
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
}