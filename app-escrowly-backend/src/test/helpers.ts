import { prisma } from "../lib/prisma.js";

export async function truncateTables() {
  await prisma.$executeRaw`TRUNCATE TABLE "stripe_webhook_events" CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "ledger_entries" CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "milestones" CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "contracts" CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "sessions" CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "users" CASCADE`;
}
