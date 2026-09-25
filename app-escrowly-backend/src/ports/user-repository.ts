import { User } from "@prisma/client";

export interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  findById(id: string): Promise<User | null>;
  create(data: {
    email: string;
    passwordHash: string;
  }): Promise<User>;
}
