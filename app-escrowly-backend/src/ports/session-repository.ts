import { Session } from "@prisma/client";

export interface SessionRepository {
  findByAccessJti(jti: string): Promise<Session | null>;
  findBySessionId(sessionId: string): Promise<Session | null>;
  create(data: {
    userId: string;
    refreshHash: string;
    accessJti: string;
    expiresAt: Date;
  }): Promise<Session>;
  update(
    id: string,
    data: Partial<Pick<Session, "refreshHash" | "accessJti" | "revokedAt">>,
  ): Promise<Session>;
}
