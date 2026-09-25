import { prisma } from "../lib/prisma.js";

export async function truncateTables() {
  await prisma.$executeRaw`TRUNCATE TABLE "sessions" CASCADE`;
  await prisma.$executeRaw`TRUNCATE TABLE "users" CASCADE`;
}
