import { User } from "@prisma/client";
import { UserRepository } from "../../ports/user-repository.js";
import { UpdateProfileInput } from "./users.schemas.js";

const FORBIDDEN_FIELDS = ["role", "passwordHash", "email"] as const;

function stripPasswordHash(user: User) {
  const { passwordHash: _, ...safe } = user;
  return safe;
}

export class UsersService {
  constructor(private users: UserRepository) {}

  async getProfile(userId: string) {
    const user = await this.users.findById(userId);
    if (!user) {
      const err = new Error("User not found") as Error & {
        statusCode: number;
        code: string;
      };
      err.statusCode = 404;
      err.code = "NOT_FOUND";
      throw err;
    }
    return stripPasswordHash(user);
  }

  async updateProfile(userId: string, input: UpdateProfileInput, rawBody: Record<string, unknown>) {
    const rawKeys = Object.keys(rawBody);
    const forbidden = rawKeys.filter((k) => (FORBIDDEN_FIELDS as readonly string[]).includes(k));
    if (forbidden.length > 0) {
      const err = new Error("Forbidden field update") as Error & {
        statusCode: number;
        code: string;
        details: Record<string, string[]>;
      };
      err.statusCode = 403;
      err.code = "FORBIDDEN";
      err.details = Object.fromEntries(forbidden.map((f) => [f, [`Cannot update ${f}`]])) as Record<
        string,
        string[]
      >;
      throw err;
    }

    return this.users.update(userId, { name: input.name });
  }
}
