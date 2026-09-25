import type { Milestone, Prisma } from "@prisma/client";

export type Tx = Prisma.TransactionClient;

export interface CreateMilestoneInput {
  contractId: string;
  title: string;
  amount: number;
}

export interface MilestoneRepository {
  findById(id: string, tx?: Tx): Promise<Milestone | null>;
  listByContract(contractId: string, tx?: Tx): Promise<Milestone[]>;
  findByStripePaymentIntentId(
    paymentIntentId: string,
    tx?: Tx,
  ): Promise<Milestone | null>;
  setStripePaymentIntentId(
    id: string,
    paymentIntentId: string,
    tx?: Tx,
  ): Promise<Milestone>;
  transitionStatusIf(
    id: string,
    fromStatus: Milestone["status"],
    toStatus: Milestone["status"],
    extra?: { paidAt?: Date; stripeTransferId?: string },
    tx?: Tx,
  ): Promise<Milestone | null>;
}
