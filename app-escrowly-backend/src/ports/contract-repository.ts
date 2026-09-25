import type { Contract, Milestone, Prisma } from "@prisma/client";

export type Tx = Prisma.TransactionClient;

export interface ContractWithMilestones extends Contract {
  milestones: Milestone[];
}

export interface CreateContractInput {
  clientId: string;
  sellerId: string;
  milestones: { title: string; amount: number }[];
}

export interface ContractRepository {
  findById(id: string, tx?: Tx): Promise<ContractWithMilestones | null>;
  listByParticipant(userId: string, tx?: Tx): Promise<Contract[]>;
  create(input: CreateContractInput, tx?: Tx): Promise<ContractWithMilestones>;
  transitionStatusIf(
    id: string,
    fromStatus: Contract["status"],
    toStatus: Contract["status"],
    tx?: Tx,
  ): Promise<Contract | null>;
}
