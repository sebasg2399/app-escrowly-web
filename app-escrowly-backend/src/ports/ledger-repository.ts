import type { LedgerEntry, Prisma } from "@prisma/client";

export type Tx = Prisma.TransactionClient;

export interface CreateLedgerEntryInput {
  milestoneId?: string;
  contractId?: string;
  kind: LedgerEntry["kind"];
  side: LedgerEntry["side"];
  amount: number;
  currency?: string;
  reference?: string | null;
  idempotencyKey: string;
}

export interface LedgerRepository {
  findByIdempotencyKey(key: string, tx?: Tx): Promise<LedgerEntry | null>;
  create(input: CreateLedgerEntryInput, tx?: Tx): Promise<LedgerEntry>;
  sumCreditsForMilestone(milestoneId: string, tx?: Tx): Promise<number>;
}
