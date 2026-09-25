import { User } from "@prisma/client";

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(data: { email: string; name: string; passwordHash: string }): Promise<User>;
  update(id: string, data: { name?: string }): Promise<User>;
  findByStripeAccountId(stripeAccountId: string): Promise<User | null>;
  setStripeAccountId(id: string, stripeAccountId: string): Promise<User>;
}