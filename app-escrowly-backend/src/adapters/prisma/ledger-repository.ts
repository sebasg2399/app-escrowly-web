import { Prisma, PrismaClient } from "@prisma/client";
import {
  CreateLedgerEntryInput,
  LedgerRepository,
  Tx,
} from "../../ports/ledger-repository.js";

export function createPrismaLedgerRepository(prisma: PrismaClient): LedgerRepository {
  const client = (tx?: Tx) => (tx ?? prisma);

  return {
    async findByIdempotencyKey(key, tx) {
      return client(tx).ledgerEntry.findUnique({ where: { idempotencyKey: key } });
    },

    async create(input: CreateLedgerEntryInput, tx) {
      try {
        return await client(tx).ledgerEntry.create({
          data: {
            milestoneId: input.milestoneId ?? null,
            contractId: input.contractId ?? null,
            kind: input.kind,
            side: input.side,
            amount: input.amount,
            currency: input.currency ?? "usd",
            reference: input.reference ?? null,
            idempotencyKey: input.idempotencyKey,
          },
        });
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          const existing = await client(tx).ledgerEntry.findUnique({
            where: { idempotencyKey: input.idempotencyKey },
          });
          if (existing) return existing;
        }
        throw err;
      }
    },

    async sumCreditsForMilestone(milestoneId, tx) {
      const rows = await client(tx).ledgerEntry.findMany({
        where: { milestoneId, side: "credit" },
        select: { amount: true },
      });
      return rows.reduce((sum, r) => sum + r.amount, 0);
    },
  };
}
