import { PrismaClient } from "@prisma/client";
import {
  CreateMilestoneInput,
  MilestoneRepository,
  Tx,
} from "../../ports/milestone-repository.js";

export function createPrismaMilestoneRepository(prisma: PrismaClient): MilestoneRepository {
  const client = (tx?: Tx) => (tx ?? prisma);

  return {
    async findById(id, tx) {
      return client(tx).milestone.findUnique({ where: { id } });
    },

    async listByContract(contractId, tx) {
      return client(tx).milestone.findMany({
        where: { contractId },
        orderBy: { createdAt: "asc" },
      });
    },

    async findByStripePaymentIntentId(paymentIntentId, tx) {
      return client(tx).milestone.findUnique({
        where: { stripePaymentIntentId: paymentIntentId },
      });
    },

    async setStripePaymentIntentId(id, paymentIntentId, tx) {
      return client(tx).milestone.update({
        where: { id },
        data: { stripePaymentIntentId: paymentIntentId },
      });
    },

    async transitionStatusIf(id, fromStatus, toStatus, extra, tx) {
      const result = await client(tx).milestone.updateMany({
        where: { id, status: fromStatus },
        data: { status: toStatus, ...(extra?.paidAt ? { paidAt: extra.paidAt } : {}) },
      });
      if (result.count === 0) return null;
      return client(tx).milestone.findUnique({ where: { id } });
    },
  };
}
