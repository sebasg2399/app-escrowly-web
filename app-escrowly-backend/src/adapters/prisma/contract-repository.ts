import { PrismaClient } from "@prisma/client";
import {
  ContractRepository,
  ContractWithMilestones,
  CreateContractInput,
  Tx,
} from "../../ports/contract-repository.js";

export function createPrismaContractRepository(prisma: PrismaClient): ContractRepository {
  const client = (tx?: Tx) => (tx ?? prisma);

  return {
    async findById(id, tx): Promise<ContractWithMilestones | null> {
      return client(tx).contract.findUnique({
        where: { id },
        include: { milestones: { orderBy: { createdAt: "asc" } } },
      }) as Promise<ContractWithMilestones | null>;
    },

    async listByParticipant(userId, tx) {
      return client(tx).contract.findMany({
        where: { OR: [{ clientId: userId }, { sellerId: userId }] },
        orderBy: { createdAt: "desc" },
      });
    },

    async create(input: CreateContractInput, tx): Promise<ContractWithMilestones> {
      return client(tx).contract.create({
        data: {
          clientId: input.clientId,
          sellerId: input.sellerId,
          milestones: {
            create: input.milestones.map((m) => ({
              title: m.title,
              amount: m.amount,
            })),
          },
        },
        include: { milestones: { orderBy: { createdAt: "asc" } } },
      }) as Promise<ContractWithMilestones>;
    },

    async transitionStatusIf(id, fromStatus, toStatus, tx) {
      const result = await client(tx).contract.updateMany({
        where: { id, status: fromStatus },
        data: { status: toStatus },
      });
      if (result.count === 0) return null;
      return client(tx).contract.findUnique({ where: { id } });
    },
  };
}
