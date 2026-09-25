import Fastify, { FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import { env } from "./config/env.js";
import { errorHandlerPlugin } from "./plugins/error-handler.js";
import { loggerPlugin } from "./plugins/logger.js";
import { authPlugin } from "./plugins/auth.js";
import { rateLimitPlugin } from "./plugins/rate-limit.js";
import { prisma } from "./lib/prisma.js";
import { createPrismaUserRepository } from "./adapters/prisma/user-repository.js";
import { createPrismaSessionRepository } from "./adapters/prisma/session-repository.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { UsersService } from "./modules/users/users.service.js";
import { usersRoutes } from "./modules/users/users.routes.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // we manage logging via loggerPlugin
  });

  // Register plugins
  await app.register(loggerPlugin);
  await app.register(errorHandlerPlugin);
  await app.register(cookie);

  // Repositories
  const userRepo = createPrismaUserRepository(prisma);
  const sessionRepo = createPrismaSessionRepository(prisma);

  // Registers @fastify/jwt (root scope) and the `authenticate` decorator
  await app.register(authPlugin, {
    jwtSecret: env.JWT_SECRET,
    sessionRepository: sessionRepo,
  });

  // Auth service
  const authService = new AuthService(
    app,
    userRepo,
    sessionRepo,
    env.ACCESS_TOKEN_TTL,
    env.REFRESH_TOKEN_TTL_DAYS,
    env.COOKIE_NAME,
    env.NODE_ENV === "production",
  );

  // Rate-limit + auth routes in same encapsulated context
  await app.register(async (scope) => {
    await scope.register(rateLimitPlugin, {
      max: 10,
      timeWindow: "1 minute",
    });
    await authRoutes(scope, { authService, env });
  });

  // Users routes
  await usersRoutes(app, { usersService: new UsersService(userRepo) });

  // --- Health check ---
  app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

  return app;
}
