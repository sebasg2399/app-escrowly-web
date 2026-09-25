import { PrismaClient, Session } from "@prisma/client";
import { SessionRepository } from "../../ports/session-repository.js";

export function createPrismaSessionRepository(
  prisma: PrismaClient,
): SessionRepository {
  return {
    async findByAccessJti(jti: string): Promise<Session | null> {
      return prisma.session.findUnique({ where: { accessJti: jti } });
    },

    async findBySessionId(sessionId: string): Promise<Session | null> {
      return prisma.session.findUnique({ where: { id: sessionId } });
    },

    async create(data: {
      userId: string;
      refreshHash: string;
      accessJti: string;
      expiresAt: Date;
    }): Promise<Session> {
      return prisma.session.create({
        data: {
          userId: data.userId,
          refreshHash: data.refreshHash,
          accessJti: data.accessJti,
          expiresAt: data.expiresAt,
        },
      });
    },

    async update(
      id: string,
      data: Partial<Pick<Session, "refreshHash" | "accessJti" | "revokedAt">>,
    ): Promise<Session> {
      return prisma.session.update({ where: { id }, data });
    },
  };
}
