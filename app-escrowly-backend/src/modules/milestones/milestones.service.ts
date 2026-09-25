import type { Milestone } from "@prisma/client";
import type { ContractRepository } from "../../ports/contract-repository.js";
import type { MilestoneRepository } from "../../ports/milestone-repository.js";

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

export class MilestonesService {
  constructor(
    private contracts: ContractRepository,
    private milestones: MilestoneRepository,
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
}