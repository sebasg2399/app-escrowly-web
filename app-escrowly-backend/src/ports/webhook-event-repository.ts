import type { Prisma } from "@prisma/client";

export type Tx = Prisma.TransactionClient;

export interface StripeWebhookEventRow {
  eventId: string;
  type: string;
}

export interface WebhookEventRepository {
  tryInsert(event: StripeWebhookEventRow, tx?: Tx): Promise<boolean>;
  exists(eventId: string, tx?: Tx): Promise<boolean>;
}
