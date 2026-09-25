import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fp from "fastify-plugin";
import { SessionRepository } from "../ports/session-repository.js";

export interface AuthPluginOptions {
  jwtSecret: string;
  sessionRepository: SessionRepository;
}

// Decorator type for the authenticate function
type AuthenticateFn = (request: FastifyRequest, reply: FastifyReply) => Promise<void>;

export const authPlugin = fp(
  async (app: FastifyInstance, opts: AuthPluginOptions) => {
    await app.register(import("@fastify/jwt"), {
      secret: opts.jwtSecret,
    });

    const authenticate: AuthenticateFn = async (request: FastifyRequest, _reply: FastifyReply) => {
      try {
        const decoded = await request.jwtVerify<{
          sub: string;
          role: string;
          jti: string;
          exp: number;
        }>();

        // Type-narrow the decoded JWT
        const user = decoded as {
          sub: string;
          role: string;
          jti: string;
          exp: number;
        };
        (request as any).user = user;

        // Check session revocation via accessJti
        const session = await opts.sessionRepository.findByAccessJti(user.jti);
        if (!session || session.revokedAt) {
          const err = new Error("Session revoked") as Error & {
            statusCode: number;
            code: string;
          };
          err.statusCode = 401;
          err.code = "UNAUTHORIZED";
          throw err;
        }
      } catch (err: any) {
        if (err.code === "UNAUTHORIZED") throw err;
        const authErr = new Error(err.message || "Unauthorized") as Error & {
          statusCode: number;
          code: string;
        };
        authErr.statusCode = 401;
        authErr.code = "UNAUTHORIZED";
        throw authErr;
      }
    };

    // Register as instance decorator (usable in preHandler)
    app.decorate("authenticate", authenticate);
  },
  { name: "auth-plugin", dependencies: ["error-handler-plugin"] },
);
