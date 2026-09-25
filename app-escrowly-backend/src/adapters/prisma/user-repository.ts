import { PrismaClient, User } from "@prisma/client";
import { UserRepository } from "../../ports/user-repository.js";

export function createPrismaUserRepository(
  prisma: PrismaClient,
): UserRepository {
  return {
    async findByEmail(email: string): Promise<User | null> {
      return prisma.user.findUnique({ where: { email } });
    },

    async findById(id: string): Promise<User | null> {
      return prisma.user.findUnique({ where: { id } });
    },

    async create(data: {
      email: string;
      passwordHash: string;
    }): Promise<User> {
      return prisma.user.create({
        data: {
          email: data.email,
          passwordHash: data.passwordHash,
        },
      });
    },
  };
}
