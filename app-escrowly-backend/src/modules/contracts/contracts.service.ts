import type { PrismaClient } from "@prisma/client";
import type { UserRepository } from "../../ports/user-repository.js";
import type {
  ContractRepository,
  ContractWithMilestones,
} from "../../ports/contract-repository.js";
import type { CreateContractInput } from "./contracts.schemas.js";
import { assertParticipant } from "../../lib/authorization.js";

function notFound(message: string): Error & { statusCode: number; code: string } {
  const err = new Error(message) as Error & { statusCode: number; code: string };
  err.statusCode = 404;
  err.code = "NOT_FOUND";
  return err;
}

function selfSellerError(): Error & {
  statusCode: number;
  code: string;
  details: Record<string, string[]>;
} {
  const err = new Error("Cannot create a contract with yourself as the seller") as Error & {
    statusCode: number;
    code: string;
    details: Record<string, string[]>;
  };
  err.statusCode = 400;
  err.code = "VALIDATION_ERROR";
  err.details = { sellerEmail: ["Seller must be a different user"] };
  return err;
}

export class ContractsService {
  constructor(
    private users: UserRepository,
    private contracts: ContractRepository,
    private prisma: PrismaClient,
  ) {}

  async create(clientId: string, input: CreateContractInput): Promise<ContractWithMilestones> {
    const seller = await this.users.findByEmail(input.sellerEmail);
    if (!seller) {
      throw notFound(`Seller with email ${input.sellerEmail} not found`);
    }
    if (seller.id === clientId) {
      throw selfSellerError();
    }

    return this.prisma.$transaction((tx) =>
      this.contracts.create(
        {
          clientId,
          sellerId: seller.id,
          milestones: input.milestones.map((m) => ({
            title: m.title,
            amount: m.amount,
          })),
        },
        tx,
      ),
    );
  }

  async listForUser(userId: string) {
    return this.contracts.listByParticipant(userId);
  }

  async getForUser(contractId: string, userId: string): Promise<ContractWithMilestones> {
    const contract = await this.contracts.findById(contractId);
    if (!contract) {
      throw notFound("Contract not found");
    }
    assertParticipant(contract, userId);
    return contract;
  }
}