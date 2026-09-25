import type { Contract, User } from "@prisma/client";

function forbidden(message: string): Error & {
  statusCode: number;
  code: string;
} {
  const err = new Error(message) as Error & {
    statusCode: number;
    code: string;
  };
  err.statusCode = 403;
  err.code = "FORBIDDEN";
  return err;
}

export function assertParticipant(contract: Contract, userId: string): void {
  if (contract.clientId !== userId && contract.sellerId !== userId) {
    throw forbidden("Not a participant of this contract");
  }
}

export function assertRole(user: User, role: User["role"]): void {
  if (user.role !== role) {
    throw forbidden(`Requires role: ${role}`);
  }
}
