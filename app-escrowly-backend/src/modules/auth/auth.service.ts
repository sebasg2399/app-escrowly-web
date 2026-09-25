import { FastifyInstance } from "fastify";
import { UserRepository } from "../../ports/user-repository.js";
import { SessionRepository } from "../../ports/session-repository.js";
import { hashPassword, verifyPassword } from "./password.js";
import {
  generateRefreshSecret,
  hashRefreshSecret,
  generateAccessJti,
  signAccessToken,
  buildRefreshCookieValue,
  parseRefreshCookieValue,
} from "./tokens.js";
import { RegisterInput, LoginInput } from "./auth.schemas.js";

export class AuthService {
  constructor(
    private app: FastifyInstance,
    private users: UserRepository,
    private sessions: SessionRepository,
    private accessTokenTtl: string,
    private refreshTtlDays: number,
    private cookieName: string,
    private isProduction: boolean,
  ) {}

  async register(input: RegisterInput) {
    const existing = await this.users.findByEmail(input.email);
    if (existing) {
      const err = new Error("Email already registered") as Error & {
        statusCode: number;
        code: string;
      };
      err.statusCode = 409;
      err.code = "CONFLICT";
      throw err;
    }

    const passwordHash = await hashPassword(input.password);
    const user = await this.users.create({
      email: input.email,
      name: input.name,
      passwordHash,
    });

    return this.createSessionAndTokens(user.id, user.role);
  }

  async login(input: LoginInput) {
    const user = await this.users.findByEmail(input.email);
    if (!user) {
      const err = new Error("Invalid credentials") as Error & {
        statusCode: number;
        code: string;
      };
      err.statusCode = 401;
      err.code = "UNAUTHORIZED";
      throw err;
    }

    const valid = await verifyPassword(user.passwordHash, input.password);
    if (!valid) {
      const err = new Error("Invalid credentials") as Error & {
        statusCode: number;
        code: string;
      };
      err.statusCode = 401;
      err.code = "UNAUTHORIZED";
      throw err;
    }

    return this.createSessionAndTokens(user.id, user.role);
  }

  async logout(sessionId: string) {
    await this.sessions.update(sessionId, { revokedAt: new Date() });
  }

  async findSessionByAccessJti(jti: string) {
    return this.sessions.findByAccessJti(jti);
  }

  async refresh(refreshCookieValue: string) {
    const parsed = parseRefreshCookieValue(refreshCookieValue);
    if (!parsed) {
      const err = new Error("Invalid refresh token") as Error & {
        statusCode: number;
        code: string;
      };
      err.statusCode = 401;
      err.code = "UNAUTHORIZED";
      throw err;
    }

    const session = await this.sessions.findBySessionId(parsed.sessionId);
    if (!session) {
      const err = new Error("Invalid refresh token") as Error & {
        statusCode: number;
        code: string;
      };
      err.statusCode = 401;
      err.code = "UNAUTHORIZED";
      throw err;
    }

    if (session.revokedAt) {
      const err = new Error("Session revoked") as Error & {
        statusCode: number;
        code: string;
      };
      err.statusCode = 401;
      err.code = "UNAUTHORIZED";
      throw err;
    }

    if (session.expiresAt < new Date()) {
      const err = new Error("Refresh token expired") as Error & {
        statusCode: number;
        code: string;
      };
      err.statusCode = 401;
      err.code = "UNAUTHORIZED";
      throw err;
    }

    const expectedHash = hashRefreshSecret(parsed.secret);
    if (session.refreshHash !== expectedHash) {
      const err = new Error("Invalid refresh token") as Error & {
        statusCode: number;
        code: string;
      };
      err.statusCode = 401;
      err.code = "UNAUTHORIZED";
      throw err;
    }

    // Rotate: new secret + new accessJti
    const newSecret = generateRefreshSecret();
    const newRefreshHash = hashRefreshSecret(newSecret);
    const newAccessJti = generateAccessJti();

    await this.sessions.update(session.id, {
      refreshHash: newRefreshHash,
      accessJti: newAccessJti,
    });

    // Re-fetch user for role
    const user = await this.users.findById(session.userId);
    if (!user) {
      const err = new Error("User not found") as Error & {
        statusCode: number;
        code: string;
      };
      err.statusCode = 401;
      err.code = "UNAUTHORIZED";
      throw err;
    }

    const accessToken = signAccessToken(
      this.app,
      { sub: user.id, role: user.role, jti: newAccessJti },
      this.accessTokenTtl,
    );

    return {
      accessToken,
      cookieValue: buildRefreshCookieValue(session.id, newSecret),
    };
  }

  private async createSessionAndTokens(userId: string, role: string) {
    const secret = generateRefreshSecret();
    const refreshHash = hashRefreshSecret(secret);
    const accessJti = generateAccessJti();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.refreshTtlDays);

    const session = await this.sessions.create({
      userId,
      refreshHash,
      accessJti,
      expiresAt,
    });

    const accessToken = signAccessToken(
      this.app,
      { sub: userId, role, jti: accessJti },
      this.accessTokenTtl,
    );

    return {
      accessToken,
      cookieValue: buildRefreshCookieValue(session.id, secret),
    };
  }
}
