import type { Contract, Milestone, Prisma } from "@prisma/client";

export type Tx = Prisma.TransactionClient;

export interface ContractParticipant {
  id: string;
  email: string;
  name: string;
}

/**
 * A contract with the relations the API returns: both participants and the
 * milestones. The list and detail endpoints MUST return this shape (the
 * frontend reads client/seller for the counterparty and milestones for the
 * total and progress).
 */
export interface ContractWithMilestones extends Contract {
  client: ContractParticipant;
  seller: ContractParticipant;
  milestones: Milestone[];
}

export interface CreateContractInput {
  clientId: string;
  sellerId: string;
  milestones: { title: string; amount: number }[];
}

export interface ContractRepository {
  findById(id: string, tx?: Tx): Promise<ContractWithMilestones | null>;
  listByParticipant(userId: string, tx?: Tx): Promise<ContractWithMilestones[]>;
  create(input: CreateContractInput, tx?: Tx): Promise<ContractWithMilestones>;
  transitionStatusIf(
    id: string,
    fromStatus: Contract["status"],
    toStatus: Contract["status"],
    tx?: Tx,
  ): Promise<Contract | null>;
}
