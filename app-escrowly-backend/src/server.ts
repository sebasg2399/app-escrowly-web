import { buildApp } from "./app.js";
import { env } from "./config/env.js";

async function bootstrap() {
  const app = await buildApp();

  try {
    await app.listen({ port: env.PORT, host: "0.0.0.0" });
    app.log.info(`Server listening on http://0.0.0.0:${env.PORT}`);
  } catch (err) {
    app.log.error(err, "Failed to start server");
    process.exit(1);
  }

  // Graceful shutdown
  const signals = ["SIGINT", "SIGTERM"] as const;
  for (const signal of signals) {
    process.on(signal, async () => {
      app.log.info(`${signal} received, shutting down gracefully`);
      try {
        await app.close();
        app.log.info("Server closed");
        process.exit(0);
      } catch (err) {
        app.log.error(err, "Error during shutdown");
        process.exit(1);
      }
    });
  }
}

bootstrap();
