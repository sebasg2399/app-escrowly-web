import Fastify, { FastifyInstance } from "fastify";
import cookie from "@fastify/cookie";
import { env } from "./config/env.js";
import { errorHandlerPlugin } from "./plugins/error-handler.js";
import { loggerPlugin } from "./plugins/logger.js";
import { authPlugin } from "./plugins/auth.js";
import { rateLimitPlugin } from "./plugins/rate-limit.js";
import { stripeWebhooksPlugin } from "./plugins/stripe-webhooks.js";
import { prisma } from "./lib/prisma.js";
import { createPrismaUserRepository } from "./adapters/prisma/user-repository.js";
import { createPrismaSessionRepository } from "./adapters/prisma/session-repository.js";
import { createPrismaContractRepository } from "./adapters/prisma/contract-repository.js";
import { createPrismaMilestoneRepository } from "./adapters/prisma/milestone-repository.js";
import { createPrismaLedgerRepository } from "./adapters/prisma/ledger-repository.js";
import { createPrismaWebhookEventRepository } from "./adapters/prisma/webhook-event-repository.js";
import { createStripeClient } from "./adapters/stripe/stripe-client.js";
import { createFakeStripeClient, FakeStripeClient } from "./adapters/stripe/stripe-client.fake.js";
import type { StripeClient } from "./ports/stripe-client.js";
import { AuthService } from "./modules/auth/auth.service.js";
import { authRoutes } from "./modules/auth/auth.routes.js";
import { UsersService } from "./modules/users/users.service.js";
import { usersRoutes } from "./modules/users/users.routes.js";
import { ContractsService } from "./modules/contracts/contracts.service.js";
import { contractsRoutes } from "./modules/contracts/contracts.routes.js";
import { MilestonesService } from "./modules/milestones/milestones.service.js";
import { milestonesRoutes } from "./modules/milestones/milestones.routes.js";
import { readFileSync, existsSync } from "node:fs";

function readPackageVersion(): string {
  const pkgPath = new URL("../../package.json", import.meta.url).pathname;
  if (existsSync(pkgPath)) {
    return JSON.parse(readFileSync(pkgPath, "utf-8")).version;
  }
  return "0.1.0";
}

function buildStripeClient(): StripeClient {
  if (env.NODE_ENV === "test" || !env.STRIPE_SECRET_KEY) {
    const fake = createFakeStripeClient();
    if (env.STRIPE_WEBHOOK_SECRET) {
      fake.webhook.setSecret(env.STRIPE_WEBHOOK_SECRET);
    }
    return fake;
  }
  return createStripeClient({
    apiKey: env.STRIPE_SECRET_KEY,
    apiVersion: env.STRIPE_API_VERSION,
  });
}

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // we manage logging via loggerPlugin
  });

  // OpenAPI spec generation
  await app.register(import("@fastify/swagger"), {
    openapi: {
      info: {
        title: "Escrowly API",
        version: readPackageVersion(),
      },
      servers: [{ url: `http://localhost:${env.PORT}` }],
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
        },
      },
    },
  });

  if (env.NODE_ENV !== "production") {
    await app.register(import("@fastify/swagger-ui"), {
      routePrefix: "/docs",
    });
  }

  // Register plugins
  await app.register(loggerPlugin);
  await app.register(errorHandlerPlugin);
  await app.register(cookie);

  // Repositories
  const userRepo = createPrismaUserRepository(prisma);
  const sessionRepo = createPrismaSessionRepository(prisma);
  const contractRepo = createPrismaContractRepository(prisma);
  const milestoneRepo = createPrismaMilestoneRepository(prisma);
  const ledgerRepo = createPrismaLedgerRepository(prisma);
  const webhookEventRepo = createPrismaWebhookEventRepository(prisma);

  // Stripe client (fake in test, real otherwise)
  const stripeClient = buildStripeClient();

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

  // Contracts + milestones routes
  await contractsRoutes(app, {
    contractsService: new ContractsService(userRepo, contractRepo, prisma),
  });
  await milestonesRoutes(app, {
    milestonesService: new MilestonesService(contractRepo, milestoneRepo, stripeClient, prisma),
  });

  // --- Health check ---
  app.get(
    "/health",
    {
      schema: {
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string" },
              timestamp: { type: "string", format: "date-time" },
            },
            required: ["status", "timestamp"],
          },
        },
      },
    },
    async () => ({ status: "ok", timestamp: new Date().toISOString() }),
  );

  // Stripe webhook receiver — encapsulated so its raw-body parser does
  // not affect the global JSON parser used by other routes.
  await app.register(stripeWebhooksPlugin, {
    stripeClient,
    prisma,
    contractRepository: contractRepo,
    milestoneRepository: milestoneRepo,
    ledgerRepository: ledgerRepo,
    webhookEventRepository: webhookEventRepo,
    userRepository: userRepo,
  });

  // Expose for tests so they can grab the fake Stripe client + emit events.
  if (env.NODE_ENV === "test") {
    Object.assign(app, { stripeClient: stripeClient as FakeStripeClient });
  }

  return app;
}