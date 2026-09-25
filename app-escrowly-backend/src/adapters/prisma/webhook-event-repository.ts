import { Prisma, PrismaClient } from "@prisma/client";
import {
  StripeWebhookEventRow,
  Tx,
  WebhookEventRepository,
} from "../../ports/webhook-event-repository.js";

export function createPrismaWebhookEventRepository(
  prisma: PrismaClient,
): WebhookEventRepository {
  const client = (tx?: Tx) => (tx ?? prisma);

  return {
    async tryInsert(event: StripeWebhookEventRow, tx): Promise<boolean> {
      try {
        await client(tx).stripeWebhookEvent.create({
          data: { eventId: event.eventId, type: event.type },
        });
        return true;
      } catch (err) {
        if (
          err instanceof Prisma.PrismaClientKnownRequestError &&
          err.code === "P2002"
        ) {
          return false;
        }
        throw err;
      }
    },

    async exists(eventId, tx) {
      const row = await client(tx).stripeWebhookEvent.findUnique({
        where: { eventId },
        select: { eventId: true },
      });
      return row !== null;
    },
  };
}
