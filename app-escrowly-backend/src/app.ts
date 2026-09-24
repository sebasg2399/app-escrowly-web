import Fastify, { FastifyInstance } from "fastify";
import { errorHandlerPlugin } from "./plugins/error-handler.js";
import { loggerPlugin } from "./plugins/logger.js";

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: false, // we manage logging via loggerPlugin
  });

  // Register plugins
  await app.register(loggerPlugin);
  await app.register(errorHandlerPlugin);

  // --- Health check ---
  app.get("/health", async () => ({ status: "ok", timestamp: new Date().toISOString() }));

  return app;
}
