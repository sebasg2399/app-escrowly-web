import { PrismaClient, User } from "@prisma/client";
import { StripeAccountFlags, UserRepository } from "../../ports/user-repository.js";

export function createPrismaUserRepository(prisma: PrismaClient): UserRepository {
  return {
    async findByEmail(email: string): Promise<User | null> {
      return prisma.user.findUnique({ where: { email } });
    },

    async findById(id: string): Promise<User | null> {
      return prisma.user.findUnique({ where: { id } });
    },

    async create(data: { email: string; name: string; passwordHash: string }): Promise<User> {
      return prisma.user.create({
        data: {
          email: data.email,
          name: data.name,
          passwordHash: data.passwordHash,
        },
      });
    },

    async update(id: string, data: { name?: string }): Promise<User> {
      return prisma.user.update({
        where: { id },
        data: {
          ...(data.name !== undefined && { name: data.name }),
        },
      });
    },

    async findByStripeAccountId(stripeAccountId: string): Promise<User | null> {
      return prisma.user.findFirst({ where: { stripeAccountId } });
    },

    async updateStripeAccountFlags(id: string, flags: StripeAccountFlags): Promise<User> {
      return prisma.user.update({
        where: { id },
        data: {
          stripeAccountPayoutsEnabled: flags.payoutsEnabled,
          stripeAccountDetailsSubmitted: flags.detailsSubmitted,
        },
      });
    },
  };
}